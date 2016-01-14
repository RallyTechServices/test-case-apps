Ext.define("last-verdict-by-release", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    integrationHeaders : {
        name : "last-verdict-by-release"
    },

    onScopedDashboard: false,
    scopeType: 'release',
    artifactModels: ['Defect', 'UserStory','TestSet'],
    artifactFetch: ['ObjectID','Project','FormattedID','Name'],
    testCaseFetch: ['FormattedID','Name','LastVerdict','ObjectID','WorkProduct','Owner','LastRun','FirstName','LastName'],
    notTestedText: 'Not Tested',

    launch: function() {
        this.logger.log('launch');
        var context = this.getContext();

        this._fetchPrefixes().then({
            success: function(prefixHash){
                this.logger.log('launch prefix records', prefixHash);
                this.prefixHash = prefixHash;
                this.onScopedDashboard = this._hasScope();
                this._addComponents(this.onScopedDashboard);

                this.onTimeboxScopeChange(context.getTimeboxScope() || null);
            },
            failure: function(msg){},
            scope: this
        });

    },
    _fetchPrefixes: function(){
        var deferred = Ext.create('Deft.Deferred');

        var filters = [{
            property: 'ElementName',
            value: 'Defect'
        },{
            property: 'ElementName',
            value: 'HierarchicalRequirement'
        },{
            property: 'ElementName',
            value: 'TestSet'
        }];
        filters = Rally.data.wsapi.Filter.or(filters);

        Ext.create('Rally.data.wsapi.Store',{
            model: 'TypeDefinition',
            fetch: ['ElementName','DisplayName','IDPrefix'],
            filters: filters
        }).load({
            callback: function(records, operation){
                var prefixHash = {};
                _.each(records, function(r){
                    prefixHash[r.get('ElementName')] = r.get('IDPrefix');
                });
                deferred.resolve(prefixHash);
            },
            scope: this
        });

        return deferred;
     },
    _hasScope: function() {
        var context = this.getContext();
        return context.getTimeboxScope() && context.getTimeboxScope().getType() === this.scopeType;
    },

    onTimeboxScopeChange: function(timebox){
        this.logger.log('onTimeboxScopeChange', timebox);
        if (timebox.type === 'release'){
            this.getContext().setTimeboxScope(timebox);
            this._update();
        }


    },
    getReleaseTimeboxRecord: function(){
        if (this.onScopedDashboard){
            return (this.getContext().getTimeboxScope() && this.getContext().getTimeboxScope().getRecord()) || null;
        }
        return this.down('rallyreleasecombobox').getRecord() || null;
    },
    _addComponents: function(hasTimeboxScope){
        this.logger.log('_addComponents');

        if (!this.down('#ct-header')){
            var header = this.add({
                xtype: 'container',
                itemId: 'ct-header',
                layout: {
                    type: 'hbox'
                }
            });

            if (!hasTimeboxScope){
                header.add({
                    xtype: 'rallyreleasecombobox',
                    listeners: {
                        scope: this,
                        change: this._update
                    }
                });
            }

            //header.add({
            //    xtype: 'rallybutton',
            //    text: 'Update',
            //    listeners: {
            //        scope: this,
            //        click: this._update
            //    }
            //});


            var tpl = new Rally.technicalservices.ProgressBarTemplate({});
            header.add({
                xtype: 'container',
                itemId: 'ct-summary',
                tpl: tpl,
                margin: '0 100 0 100',
                flex: 1

            });


            header.add({
                xtype: 'rallybutton',
                text: 'Export',
                listeners: {
                    scope: this,
                    click: this._export
                }
            });
        }
        //if (!this.down('#ct-summary')){
        //    this.add({
        //        xtype: 'container',
        //        itemId: 'ct-summary',
        //    });
        //}

    },
    _update: function(){

        this.logger.log('_update', this.getReleaseTimeboxRecord());
        if (!this.getReleaseTimeboxRecord()){
            this.down('#ct-summary').update({message: "Please select a Release"});
            if (this.down('rallygrid')){
                this.down('rallygrid').destroy();
            }
            return;
        }

        var filters = Ext.create('Rally.data.wsapi.Filter',{
            property: 'Release.Name',
            value: this.getReleaseTimeboxRecord().get('Name')
        });



        Ext.create('Rally.data.wsapi.artifact.Store', {
            models: this.artifactModels,
            fetch: this.artifactFetch,
            filters: filters,
            sorters: [{
                property: 'FormattedID',
                direction: 'ASC'
            }]
        }).load({
            callback: this._fetchTestCases,
            scope: this
        });
    },
    _getTestSetPrefix: function(){
        return this.prefixHash['TestSet'];
    },
    _getTestCaseFilters: function(artifacts){
        var prefixHash = {},
            testSetPrefix = this._getTestSetPrefix(),
            filters = [];

        _.each(artifacts, function(a){
            var fid = a.get('FormattedID'),
                prefix = fid.replace(/[0-9]/g, "");

            if (prefix === testSetPrefix){
                filters.push({
                    property: 'TestSets.FormattedID',
                    operator: 'contains',
                    value: fid
                });
            } else {
                filters.push({
                    property: 'WorkProduct.FormattedID',
                    value: fid
                });
            }
        });


        //_.each(artifacts, function(a){
        //    var fid = a.get('FormattedID'),
        //        prefix = fid.replace(/[0-9]/g, ""),
        //        num = Number(fid.replace(/[^0-9]/g, ""));
        //    console.log('pn',prefix, num);
        //    if (!prefixHash[prefix]){
        //        prefixHash[prefix] = { min: null, max: null};
        //    }
        //    if (prefixHash[prefix].min === null || prefixHash[prefix].min > num){
        //        prefixHash[prefix].min = num;
        //    }
        //    if (prefixHash[prefix].max === null || prefixHash[prefix].max < num){
        //        prefixHash[prefix].max = num;
        //    }
        //});
        //
        //
        //var filters = [];
        //_.each(prefixHash, function(obj, prefix){
        //    if (prefix !== this._getTestSetPrefix()){
        //        var filter = Ext.create('Rally.data.wsapi.Filter',{
        //            property: 'WorkProduct.FormattedID',
        //            operator: '>=',
        //            value: Ext.String.format('{0}{1}', prefix, obj.min)
        //        });
        //        filter = filter.and(Ext.create('Rally.data.wsapi.Filter',{
        //            property: 'WorkProduct.FormattedID',
        //            operator: '<=',
        //            value: Ext.String.format('{0}{1}', prefix, obj.max)
        //        }));
        //    } else {
        //        var filter = Ext.create('Rally.data.wsapi.Filter',{
        //            property: 'TestSets.FormattedID',
        //            operator: 'contains',
        //            value: Ext.String.format('{0}{1}', prefix, obj.min)
        //        });
        //        filter = filter.and(Ext.create('Rally.data.wsapi.Filter',{
        //            property: 'WorkProduct.FormattedID',
        //            operator: '<=',
        //            value: Ext.String.format('{0}{1}', prefix, obj.max)
        //        }));
        //    }
        //
        //    filters.push(filter);
        //});
        filters = Rally.data.wsapi.Filter.or(filters);
        this.logger.log('_getTestCaseFilters', filters.toString());
        return filters;

    },
    _fetchTestCases: function(artifacts, operation){
        this.logger.log('_fetchTestCases', artifacts, operation);


        var formatted_ids = _.map(artifacts, function(a){ return a.get('FormattedID'); });
        this.logger.log('formattedIds', formatted_ids);

        this.artifactRecords = artifacts;

        //TODO: check the number of artifacts.  We may want to consider chunking if this is too big....
        var filters = this._getTestCaseFilters(artifacts);

        this.logger.log('artifact filters', filters.toString());
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'TestCase',
            fetch: this.testCaseFetch,
            filters: filters,
            limit: 'Infinity',
            groupField: 'LastVerdict',
            getGroupString: function(record) {
                var verdict = record.get('LastVerdict');
                return verdict || 'Not Tested';
            }
        });

        store.on('load', this._buildSummaryGrid, this);

        this._buildGroupedGrid(store);


    },
    _buildSummaryGrid: function(store, testCaseRecords, operation){
        this.logger.log('_buildDisplay', testCaseRecords, operation, _.map(testCaseRecords, function(tc){ return tc.get('FormattedID'); }));

        var casesRun = _.filter(testCaseRecords, function(tc){ return tc.get('LastVerdict')});
        this.logger.log('_mungeData', casesRun.length, testCaseRecords.length);

        this.down('#ct-summary').update({casesRun: casesRun.length, totalCases: testCaseRecords.length});

        //
        //var store = Ext.create('Rally.data.custom.Store',{
        //    data: [{
        //        casesRun: casesRun.length,
        //        totalCases: testCaseRecords.length,
        //        percentDone: testCaseRecords.length > 0 ? casesRun.length/testCaseRecords.length : 0
        //    }]
        //});
        //
        //this.down('#ct-summary').add({
        //    xtype: 'rallygrid',
        //    store: store,
        //    showPagingToolbar: false,
        //    margin: 50,
        //    columnCfgs: [{
        //        dataIndex: 'casesRun',
        //        text: '# Test Cases Run',
        //        flex: 1
        //    },{
        //        dataIndex: 'totalCases',
        //        text: '# Test Cases associated with Release',
        //        flex: 1
        //    },{
        //        dataIndex: 'percentDone',
        //        text: 'Test Run Coverage',
        //        flex: 1,
        //        renderer: function(v,m,r){
        //            if (r){
        //                return Ext.create('Rally.technicalservices.ProgressBarTemplate',{
        //                    calculateColorFn: function(values) {
        //                        if (values.percentDone > .5){
        //                            return '#8DC63F'
        //                        } else {
        //                           return '#FAD200';
        //                        }
        //                    }
        //                }).apply(r.data);
        //            }
        //            return value;
        //        }
        //    }]
        //});

    },
    _buildGroupedGrid: function(store){

        if (this.down('#grouped-grid')){
            this.down('#grouped-grid').destroy();
        }

        this.add({
            xtype: 'rallygrid',
            store: store,
            itemId: 'grouped-grid',
            margin: 10,
            columnCfgs: this._getColumnCfgs(),
            features: [{ftype:'grouping'}]
        });
    },
    _getColumnCfgs: function(){
        return [{
            dataIndex: 'FormattedID',
            text: 'ID',
            flex: 1
        },{
            dataIndex: 'Name',
            text: 'Test Case',
            flex: 2
        },{
            dataIndex: 'WorkProduct',
            text: 'Work Item',
            exportRenderer: function(v,m,r){
                return v && v.FormattedID + ': ' + v.Name || '';
            },
            flex: 2
        },{
            dataIndex: 'LastRun',
            text: 'Last Tested',
            flex: 1
        },{
            dataIndex: 'Owner',
            text: 'Owner',
            renderer: function(v,m,r){
                return (v && (v.FirstName || '') + ' ' + (v.LastName || '')) || '(No Owner)';
            },
            flex: 1
        }];
    },
    _export: function(){
        var file_util = Ext.create('Rally.technicalservices.FileUtilities',{});
        file_util.getCSVFromGrid(this, this.down('rallygrid')).then({
            success: function(csv){
                this.setLoading(false);
                file_util.saveCSVToFile(csv, 'export.csv');
            },
            scope: this
        });
    },
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
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
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
