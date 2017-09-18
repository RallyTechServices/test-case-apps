Ext.define("test-status-by-attribute", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    integrationHeaders : {
        name : "cats-test-status-by-attribute"
    },
    config: {
       defaultSettings: {
          modelName: 'TestCase',
          xAxisField: 'LastVerdict',
          yAxisField: 'TestSet: Name',
          xAxisValues: undefined,
          yAxisValues: undefined,
          includeXTotal: true,
          includeYTotal: true,
          gridFilter: '',
          includeBlanks: true,
          sortBy: 'total',
          sortDir: 'desc',
          rowLimit: ''
       }
    },

    yAxisOptions: [],

    launch: function() {
        var me = this;
        this._initializeApp();
    },
    onTimeboxScopeChange: function(timeboxScope){
        this.logger.log('onTimeboxScopeChange', timeboxScope);
        this.getContext().setTimeboxScope(timeboxScope);
        this._updateDisplay();
    },
    _initializeApp: function(){
        fieldBlackList = ['Milestones','Tags','Release','Iteration'];
        Deft.Promise.all([
            Rally.technicalservices.WsapiToolbox.fetchModelFields('TestSet',fieldBlackList),
            Rally.technicalservices.WsapiToolbox.fetchModelFields('Artifact',fieldBlackList),
            Rally.technicalservices.WsapiToolbox.fetchModelFields('TestCase',fieldBlackList),
            Rally.technicalservices.WsapiToolbox.fetchAllowedValues('TestCaseResult','Verdict')
        ]).then({
            success: function(results){
                this._initializeYAxisOptions(results[0],results[1], results[2]);
                this.possibleVerdicts = results[3];
                this._initializeDisplay();
            },
            failure: this._showErrorNotification,
            scope: this
        });
    },

    _initializeYAxisOptions: function(testSetFields, artifactFields, testCaseFields){
        var yAxisOptions = [];

        Ext.Array.each(testCaseFields, function(f){
            var defn = f.attributeDefinition;

            if ((defn && defn.Constrained && defn.AttributeType != "COLLECTION") ||
              f.name === 'TestFolder'){
                yAxisOptions.push({
                    displayName: 'TestCase: ' + f.displayName,
                    modelName: 'TestCase',
                    fieldName: f.name,
                    queryName: f.name
                });
            }
        });

        Ext.Array.each(testSetFields, function(f){
            var defn = f.attributeDefinition;
            if ((defn && defn.Constrained && defn.AttributeType != "COLLECTION" ) ||
              f.name === 'Name'){
                yAxisOptions.push({
                    displayName: 'TestSet: ' + f.displayName,
                    modelName: 'TestSet',
                    fieldName: f.name,
                    queryName: 'TestSets.' + f.name
                });
            }
        });

        Ext.Array.each(artifactFields, function(f){
            var defn = f.attributeDefinition;
            if ((defn && defn.Constrained && defn.AttributeType != "COLLECTION" ) ||
                f.name === 'Name'){
              yAxisOptions.push({
                 displayName: 'WorkProduct: ' + f.displayName,
                 modelName: 'WorkProduct',
                 fieldName: f.name,
                 queryName: 'WorkProduct.' + f.name
              })
            }
        });

        this.logger.log('yAxisOptions', yAxisOptions);
        this.yAxisOptions = yAxisOptions;

    },
    _showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    _initializeDisplay: function(){
        var selectorBox = this.add({
            xtype: 'container',
            layout: 'hbox',
            itemId: 'selectorBox'
        });

        selectorBox.add({
            xtype: 'rallycombobox',
            store: Ext.create('Ext.data.Store',{
                fields: ['displayName','modelName','fieldName'],
                data: this.yAxisOptions
            }),
            itemId: 'yAxisField',
            labelAlign: 'right',
            margin: 5,
            fieldLabel: 'Group by',
            labelWidth: 75,
            width: 300,
            stateful: true,
            stateId: this.getContext().getScopedStateId('groupBy'),
            displayField: 'displayName',
            valueField: 'displayName'
        });

        selectorBox.add({
            xtype: 'rallybutton',
            text: 'Update',
            margin: 5,
            listeners: {
                click: this._updateDisplay,
                scope: this
            }
        });

        selectorBox.add({
            xtype: 'container',
            flex: 1
        });


        selectorBox.add({
            xtype: 'rallybutton',
            iconCls: 'icon-export',
            margin: 5,
            cls: 'rly-small secondary',
            listeners: {
                click: this._export,
                scope: this
            }
        });


        this.add({
            xtype:'container',
            itemId:'display_box'
        });
    },
    _export: function(){
       this.logger.log('_export');
       var grid = this.down('rallygrid');
       if (!grid) { return; }

       var me = this,
            y_selector = this.down('#yAxisField'),
            ySelectorDisplay = y_selector.getValue(),
            yAxisModelName = this._getAxisModelName(y_selector),
            fields = this._getExportModelFieldNames(yAxisModelName),
            headers = Ext.Array.map(fields, function(f){
               if (f === 'name'){ return 'Name'; }
               if (f === 'test_case_count_executed'){ return 'Executed Test Cases'; }
               if (f === 'test_case_count_unexecuted'){ return 'Unexecuted Test Cases'; }
               if (f === 'test_case_count'){ return 'Total Test Cases'; }
               return f;
            });

      this.logger.log('_export', fields);

      var csv = [];
      csv.push(headers.join(','));
       grid.getStore().each(function(r){
          var row = [];
          Ext.Array.each(fields, function(f){
              row.push(r.get(f) || 0);
          });
          csv.push(row.join(','));
       });
       var exportText = csv.join("\r\n"),
          fileName = Ext.String.format("{0}-{1}.csv", ySelectorDisplay.replace(/[^a-zA-Z0-9]/g,"_"), Rally.util.DateTime.format(new Date(), 'Y-m-d-h-i-s'));

       Rally.technicalservices.WsapiToolbox.saveCSVToFile(exportText, fileName);

    },
    _fetchTimeboxData: function(yAxisFieldName,yAxisModelName){
        this.logger.log('_fetchTimeboxData', yAxisFieldName, yAxisModelName, this.getContext().getTimeboxScope());
        var deferred = Ext.create('Deft.Deferred');
        this.records_in_timebox = null;
        if (!this.getContext().getTimeboxScope()){
            deferred.resolve(null);
        } else {
            var timebox = this.getContext().getTimeboxScope();
            this.logger.log('timeboxScope', this.getContext().getTimeboxScope().getQueryFilter());
            var models = ['TestSet','HierarchicalRequirement','Defect'];
            if ( yAxisModelName == "TestSet" ) { models = [yAxisModelName]; }
            if ( yAxisModelName == "WorkProduct" ) { models = ['HierarchicalRequirement','Defect']; }

            Rally.technicalservices.WsapiToolbox.fetchArtifacts({
                 models: models,
                 fetch: ['ObjectID','TestCaseCount','TestCases','LastVerdict',yAxisFieldName],
                 filters: this.getContext().getTimeboxScope().getQueryFilter()
               }).then({
                  success: function(results){
                     deferred.resolve(results);
                  },
                  failure: function(msg){
                      deferred.reject(msg);
                  }
               });
        }
        return deferred.promise;
    },
    _updateDisplay: function(){
        var me = this,
            y_selector = this.down('#yAxisField');

        if ( Ext.isEmpty(y_selector.getValue()) ) { return; }

        var yAxisModelName = this._getAxisModelName(y_selector),
            yAxisFieldName = this._getAxisFieldName(y_selector);

        this.setLoading();
        Deft.Chain.pipeline([
            function(){
               return me._fetchTimeboxData(yAxisFieldName,yAxisModelName);
            },
            function(records_in_timebox) {
                return me._fetchData(yAxisModelName,yAxisFieldName, records_in_timebox);
            },
            function(results) {
                return me._organizeTestCaseResults(yAxisModelName,yAxisFieldName,results);
            },
            function(counts) {
                return me._addSummaryColumn(counts);
            },
            function(counts) {
                return me._removeEmptyRows(counts);
            },
            function(counts) {
                return me._buildGrid(counts,yAxisModelName);
            }],this).then({
            failure: this._showErrorNotification,
            success: null,
            scope: this
        }).always(function() { me.setLoading(false);});
    },

    _getAxisModelName: function(selector) {
        var value = selector.getValue();

        var record = selector.getStore().findRecord('displayName',value);
        return record && record.get('modelName');
    },

    _getAxisFieldName: function(selector) {
        var value = selector.getValue();
        var record = selector.getStore().findRecord('displayName',value);
        return record && record.get('fieldName');
    },

    _getTestCaseResultFilters: function(yAxisModelName,yAxisFieldName, records_in_timebox){
        this.logger.log('_getTestCaseResultFilters', yAxisModelName, yAxisFieldName, records_in_timebox);

        var filters = [];
        if (records_in_timebox){
            Ext.Array.each(records_in_timebox, function(r){
               if (r.get('TestCaseCount') > 0){
                 var type = 'TestCase.WorkProduct.ObjectID';
                 if (r.get('_type') === 'testset'){
                    type = 'TestSet.ObjectID';
                 }
                 filters.push({
                    property: type,
                    value: r.get('ObjectID')
                 });
               }
            });
            if (filters.length > 1){
                filters = Rally.data.wsapi.Filter.or(filters);
            }
            if (filters.length === 0){
               //no records are in the timebox
               filters = [{
                   property: 'ObjectID',
                   value: 0
               }];
            }
        } else {  //No timebox so just get everything in scope
          if (yAxisModelName === 'Artifact'){
            filters.push({
               property: 'TestCase.WorkProduct.ObjectID',
               operator: '>',
               value: 0
            });
          } else if (yAxisModelName === 'TestSet'){
             //If timebox scoped, then add that
             filters.push({
                property: 'TestSet.ObjectID',
                operator: '>',
                value: 0
             });
          } else {
             filters = [{property:'ObjectID',operator:'>',value:0}]
          }
        }

       return filters;
    },

    _fetchData: function(yAxisModelName,yAxisFieldName, records_in_timebox){
        this.logger.log('_updateDisplay', yAxisModelName, yAxisFieldName);
        this.records_in_timebox = records_in_timebox;
        return Rally.technicalservices.WsapiToolbox.fetchWsapiRecords({
            model: 'TestCaseResult',
            fetch: ['TestCase','Verdict','TestSet','WorkProduct','ObjectID','Name','Date',yAxisFieldName],
            enablePostGet: true,
            filters: this._getTestCaseResultFilters(yAxisModelName, yAxisFieldName, records_in_timebox),
            sorters: [{property:'Date',direction:'ASC'}]
        });
    },

    _organizeTestCaseResults: function(yAxisModelName,yAxisFieldName,results){
        this.logger.log('Organize Results', results.length);
        // assumes that the results have been returned in ascending order so we can just
        // replace with the latest and eventually get the last for each test case and workproduct/testset
        // first, create a hash of hashes to distill down to the most recent result for each combo
        var results_by_testcase_and_subset = {};
        Ext.Array.each(results, function(result){
            var testcase_oid = result.get('TestCase') && result.get('TestCase').ObjectID;
            var related_item_oid = result.get(yAxisModelName) && result.get(yAxisModelName).ObjectID || 'None';
            if ( yAxisModelName === "WorkProduct" ){
                related_item_oid = result.get('TestCase')[yAxisModelName] && result.get('TestCase')[yAxisModelName].ObjectID || 'None';
            }
            if ( Ext.isEmpty(results_by_testcase_and_subset[testcase_oid]) ) {
                results_by_testcase_and_subset[testcase_oid] = {};
            }
            results_by_testcase_and_subset[testcase_oid][related_item_oid] = result;
        });
        // second, create an array of results for each field value on the related item
        var results_by_fieldvalue = {};
        // charge up with base records from the timebox (e.g., test set, workproduct) if some were gotten
        // beforehand (so they can deal with ones that don't have any results at all)
        if ( !Ext.isEmpty(this.records_in_timebox) ) {
                Ext.Array.each(this.records_in_timebox, function(base_record){
                    var type = base_record.get('_type');
                    if ( type.toLowerCase() == 'hierarchicalrequirement' || type.toLowerCase() == "defect" ) {
                        type = 'WorkProduct';
                    }
                    if ( type.toLowerCase() == yAxisModelName.toLowerCase() ) {
                        var aggregation_name = base_record.get(yAxisFieldName);
                        if ( aggregation_name._refObjectName ) { aggregation_name = aggregation_name._refObjectName; }
                        if ( Ext.isEmpty(results_by_fieldvalue[aggregation_name]) ) {
                            results_by_fieldvalue[aggregation_name] = {
                                name: aggregation_name ,
                                test_case_count: 0
                            };
                        }
                        var test_case_count = base_record.get('TestCaseCount');
                        results_by_fieldvalue[aggregation_name].test_case_count = results_by_fieldvalue[aggregation_name].test_case_count + test_case_count;
                    } else {
                        var aggregation_name = "None";
                        if ( Ext.isEmpty(results_by_fieldvalue[aggregation_name]) ) {
                            results_by_fieldvalue[aggregation_name] = {
                                name: aggregation_name ,
                                test_case_count: 0
                            };
                        }
                    }
                });
        }

        Ext.Object.each(results_by_testcase_and_subset,function(testcase_oid,related_item_results){
            Ext.Object.each(related_item_results, function(oid,result){
                var value = this._getValueFromRelatedRecord(result,yAxisModelName,yAxisFieldName);
                var verdict = result.get('Verdict');
                if ( Ext.isEmpty(results_by_fieldvalue[value]) ) {
                    results_by_fieldvalue[value] = {
                        name: value
                    };
                }
                if ( Ext.isEmpty(results_by_fieldvalue[value][verdict]) ) {
                    results_by_fieldvalue[value][verdict] = 0;
                }
                results_by_fieldvalue[value][verdict] = results_by_fieldvalue[value][verdict] + 1;
            },this);
        },this);

        return results_by_fieldvalue;
    },

    _addSummaryColumn: function(counts){
        verdict_columns = this.possibleVerdicts;

        Ext.Object.each(counts, function(key,count){
            var total = 0;
            Ext.Array.each(verdict_columns, function(verdict){
                var value = count[verdict] || 0;
                total = total + value;
            });
            count.test_case_count_executed = total;
            if ( Ext.isNumber(count.test_case_count) ) {
                if ( count.test_case_count < count.test_case_count_executed ) {
                    count.test_case_count = count.test_case_count_executed;
                }
                count.test_case_count_unexecuted = count.test_case_count - count.test_case_count_executed;
                count.Total = count.test_case_count;
            } else {
                count.Total = total;
            }

        });
        return counts;
    },

    _removeEmptyRows: function(counts) {
        var clean_counts = {};
        Ext.Object.each(counts, function(key,count) {
            if (count.Total > 0) {
                clean_counts[key] = count;
            }
        });
        return clean_counts;
    },

    _getValueFromRelatedRecord: function(result,modelname,fieldname){
        var value = "";
        if ( modelname == "TestCase" || modelname == "TestSet" ) {
            value = result.get(modelname) && result.get(modelname)[fieldname] || "None";
        } else {
            value = result.get('TestCase')[modelname] && result.get('TestCase')[modelname][fieldname] || "None";
        }

        if ( value._refObjectName ) { value = value._refObjectName; }
        return value;
    },

    /*
     * Given a hash of counts (key is field value and value is hash of verdict counts)
     */
    _buildGrid: function(counts,yAxisModelName){
        this.logger.log('_buildGrid', counts, yAxisModelName);
        var x_values = this._getXValuesFromCounts(counts,yAxisModelName);
        var rows = Ext.Object.getValues(counts);

        this.logger.log('cols',x_values);
        this.logger.log('rows',rows);

        var store = Ext.create('Rally.data.custom.Store',{
            fields: this._getModelFieldNames(yAxisModelName),
            data: rows,
            pageSize: rows.length
        });

        var container = this.down('#display_box');
        container.removeAll();

        if ( rows.length === 0 ) {
            container.add({xtype:'container',padding: 100, margin: 50,html:"No Data Found"});
            return;
        }

        container.add({
            xtype:'rallygrid',
            store: store,
            showRowActionsColumn: false,
            showPagingToolbar: false,
            columnCfgs: this._getColumns(x_values),
            features: [{
                ftype: 'summary'
            }]
        });
    },

    _getColumns: function(x_values) {
        var columns = Ext.Array.map(x_values, function(value){
            if ( value == "name" ) {
                return {
                    dataIndex:value,
                    text: "",
                    flex: 1,
                    summaryRenderer: function(value, summaryData, dataIndex) {
                        return "<div class='summary'>Total</div>";
                    }
                };
            }

            if ( value == "test_case_count_executed" ) {
              return {
                  dataIndex:value,
                  text: "",
                  renderer: function(v,m,r){
                     return Ext.create('Rally.ui.renderer.template.progressbar.ProgressBarTemplate',{
                         shouldShowPercentDone: function(recordData) {
                             return recordData.Total > 0 && Ext.isNumber(recordData.test_case_count_executed) && Ext.isNumber(recordData.test_case_count_unexecuted);
                         },
                         calculatePercent: function(recordData){
                             return Math.round((recordData.test_case_count_executed || 0) * 100/ recordData.Total);
                         },
                         calculateColorFn: function(recordData){
                            return Rally.util.Colors.blue_lt;
                         }
                     }).apply(r.getData());
                  },
                  summaryType: function(records){
                      var total = 0;
                      Ext.Array.each(records, function(record){
                          var record_value = record.get(value) || 0;
                          total = total + record_value;
                      });
                      return total;
                  },
                  summaryRenderer: function(value, summaryData, dataIndex) {
                    return Ext.create('Rally.ui.renderer.template.progressbar.ProgressBarTemplate',{
                        shouldShowPercentDone: function(recordData){
                            return recordData.Total > 0;
                        },
                        calculatePercent: function(recordData){
                            return Math.round((value || 0) * 100/recordData.Total);
                        },
                        calculateColorFn: function(recordData){
                           return Rally.util.Colors.blue_lt;

                        }
                    }).apply(summaryData.record.getData());
                  }
              };
            }

            if ( value == "test_case_count_unexecuted" ) {
                return {
                    dataIndex:value,
                    text:"Unexecuted",
                    summaryType: function(records){
                        var total = 0;
                        Ext.Array.each(records, function(record){
                            var record_value = record.get(value) || 0;
                            total = total + record_value;
                        });
                        return total;
                    },
                    align: 'center',
                    renderer: function(val, meta_data, record){
                      meta_data.tdCls = 'non-summary';
                        var total = record && record.get('Total');
                        if (total > 0){
                           return Ext.String.format("{0}<br/>{1}%",val, Math.round(val*100/total));
                        }
                        return Ext.String.format("{0}<br/>N/A",val || 0);
                    },
                    summaryRenderer: function(value, summaryData, dataIndex) {
                      var total = summaryData.record && summaryData.record.get('Total');
                      if (total > 0){
                         return Ext.String.format("<div class='summary'>{0}<br/>{1}%</div>",value, Math.round(value*100/total));
                      }
                      return Ext.String.format("<div class='summary'>{0}</div>",value || 0);
                    }
                };
            }

            return {
                dataIndex:value,
                text:value,
                summaryType: function(records){
                    var total = 0;
                    Ext.Array.each(records, function(record){
                        var record_value = record.get(value) || 0;
                        total = total + record_value;
                    });
                    return total;
                },
                align: 'center',
                cls: 'non-summary',
                renderer: function(v, m, record){
                  var total = record && record.get('Total');
                  if (total > 0){
                     return Ext.String.format("{0}<br/>{1}%",v || 0, Math.round(v*100/total));
                  }
                  return Ext.String.format("{0}<br/>N/A%",v || 0);
                },
                summaryRenderer: function(value, summaryData, dataIndex) {
                  var total = summaryData.record && summaryData.record.get('Total');
                  if (total > 0){
                     return Ext.String.format("<div class='summary'>{0}<br/>{1}%</div>",value, Math.round(value*100/total));
                  }
                  return Ext.String.format("<div class='summary'>{0}</div>",value || 0);
                }
            };
        });
        return columns;
    },

    _getModelFieldNames: function(yAxisModelName) {
        var names = ["name","test_case_count_executed","test_case_count"];
        names = names.concat(this.possibleVerdicts).concat('Total');
        if ( yAxisModelName != "TestCase" ) {
            names.push('test_case_count_unexecuted');
        }
        return Ext.Array.unique(names);
    },

    _getExportModelFieldNames: function(yAxisModelName) {
        var names = ["name","test_case_count_executed"];
        names = names.concat(this.possibleVerdicts);
        if ( yAxisModelName != "TestCase" ) {
            names.push('test_case_count_unexecuted');
        }
        names.push("test_case_count");
        return Ext.Array.unique(names);
    },


    _getXValuesFromCounts: function(counts,yAxisModelName) {
        var names = ["name","test_case_count_executed"];
        names = names.concat(this.possibleVerdicts);
        if ( yAxisModelName != "TestCase" ) {
            names.push('test_case_count_unexecuted');
        }
        names.push('Total');
        return Ext.Array.unique(names);
    },

    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }

});
