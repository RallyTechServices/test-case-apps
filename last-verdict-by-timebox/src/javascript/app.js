Ext.define("catsLastVerdictByTimebox", {
      extend: 'Rally.app.App',
      componentCls: 'app',
      logger: new Rally.technicalservices.Logger(),
      defaults: { margin: 10 },
      layout: 'border',
      integrationHeaders : {
          name : "cats-last-verdict-by-timebox"
      },

      onScopedDashboard: false,
      scopeType: 'release',
      artifactModels: ['Defect', 'UserStory','TestSet'],
      artifactFetch: ['ObjectID','Project','FormattedID','Name'],
      testCaseFetch: ['FormattedID','Name','LastVerdict','ObjectID','WorkProduct','Owner','LastRun','FirstName','LastName','TestSets:summary[FormattedID]','Method','LastBuild','Project'],
      notTestedText: 'Not Tested',

      config: {
        defaultSettings: {
          scopeSelector: 'dashboard',
          query: null
        }
      },

      noLastVerdictText: "Not Run",
      verdictColors: {
          Pass: '#3a874f',
          Fail: '#B81B10',
          "Not Run": '#C0C0C0'
      },
      chartColors: ['#FAD200','#7CAFD7','#B29DCD','#FBB990','#82D3ED'],

      launch: function(){
          if (this._validateApp()){
            this._addComponents();
            this._update();
          }
      },
      _validateApp: function(){
          var scopeSelector = this.getScopeSelectorSetting(),
              scope = this.getContext().getTimeboxScope();

          if (scopeSelector === 'dashboard' &&  (!scope)){
              this._addAppMessage("This app is configured to run on a timebox scoped dashboard.  Please update your dashboard to be timebox scoped or configure an App timebox selector in the App Settings.");
              return false;
          }
          return true;
      },

      _addAppMessage: function(msg){
        this.add({
          xtype: 'container',
          itemId: 'appMessage',
          html: Ext.String.format('<div class="no-data-container"><div class="primary-message">{0}</div></div>',msg)
        });
      },

      _clearWindow: function(){
        if (this.down('#appMessage')){
          this.down('#appMessage').destroy();
        }
      },

      onTimeboxScopeChange: function(timeboxScope){
          if (!this.getScopeSelectorSetting() === 'dashboard'){ return; }

          this.getContext().setTimeboxScope(timeboxScope);
          this.logger.log('onTimeboxScopeChange', timeboxScope, timeboxScope.getRecord());

          this._clearWindow();

        if (timeboxScope && (timeboxScope.getType() === 'release' || timeboxScope.getType() === 'iteration')){
          if (timeboxScope.getRecord()){
            this._update();
          } else {
            this._addAppMessage("Please select a timebox to see data for.");
          }
        } else {
          this._addAppMessage("This app is designed to run on a dashboard with a Release or Iteration timebox selector.");
        }
      },

      getScopeSelectorSetting: function(){
        return this.getSetting('scopeSelector');
      },

      getTimeboxRecord: function(){
          if (this.getScopeSelectorSetting() === 'dashboard'){
              return (this.getContext().getTimeboxScope() && this.getContext().getTimeboxScope().getRecord()) || null;
          }
          return this.down(this.getScopeSelectorSetting()).getRecord() || null;
      },
      _addComponents: function(){
          this.logger.log('_addComponents');

          this.removeAll();

          var northBox = this.add({
              xtype:'container',
              region: 'north'
          });

          var selectorBox = northBox.add({
              xtype: 'container',
              itemId: 'selectorBox',
              layout: 'hbox'
          });

          northBox.add({
              xtype:'container',
              itemId: 'advancedFilterBox',
              flex: 1,
              padding: 10
          });

          var scopeSelector = this.getScopeSelectorSetting();
          if (scopeSelector !== 'dashboard'){
              selectorBox.add({
                  xtype: scopeSelector,
                  margin: 5,
                  listeners: {
                      scope: this,
                      select: this._update
                  }
              });
          }

          selectorBox.add({
            xtype: 'rallyinlinefilterbutton',
            modelNames: ['TestCase'],
            context: this.getContext(),
            margin: 5,
            stateful: true,
            stateId: 'test-case-filter',
            listeners: {
              inlinefilterready: this.addInlineFilterPanel,
              inlinefilterchange: this._update,
              scope: this
            }
          });

          var tpl = new Rally.technicalservices.ProgressBarTemplate({});
          northBox.add({
              xtype: 'container',
              //itemId: 'ct-summary',
              itemId: 'chartBox',
              //tpl: tpl,
              flex: 1
          });

          selectorBox.add({
              xtype: 'rallybutton',
              //text: 'Export',
              iconCls: 'icon-export',
              cls: 'rly-small secondary',
              margin: 5,
              listeners: {
                  scope: this,
                  click: this._export
              }
          });

          this.add({
              xtype:'container',
              itemId: 'gridBox',
              region: 'center',
              layout: 'fit'
          });
      },
      getGridBox: function(){
        return this.down('#gridBox');
      },
      addInlineFilterPanel: function(panel){
        this.logger.log('addInlineFilerPanel', this)
        this.getAdvancedFilterBox().add(panel);
      },
      getAdvancedFilterBox: function(){
        return this.down('#advancedFilterBox');
      },
      getChartBox: function(){
        return this.down('#chartBox');
      },
      getTimeboxProperty: function(){
         var type = this.getTimeboxRecord() && this.getTimeboxRecord().get('_type');
         type = type.charAt(0).toUpperCase() + type.substr(1);
         this.logger.log('getTimeboxProperty', type);
         return type;
      },
      _update: function(){

          this.logger.log('_update', this.getTimeboxRecord());
          if (!this.getTimeboxRecord()){
              this.down('#ct-summary').update({message: "Please select a Release"});
              if (this.down('rallygrid')){
                  this.down('rallygrid').destroy();
              }
              return;
          }

          var filters = Ext.create('Rally.data.wsapi.Filter',{
              property: this.getTimeboxProperty() + '.Name',
              value: this.getTimeboxRecord().get('Name')
          });

          Ext.create('Rally.data.wsapi.artifact.Store', {
              models: this.artifactModels,
              fetch: this.artifactFetch,
              filters: filters,
              enablePostGet: true,
              limit: 'Infinity',
              sorters: [{
                  property: 'FormattedID',
                  direction: 'ASC'
              }]
          }).load({
              callback: this._fetchTestCases,
              scope: this
          });
      },
      _getTestCaseFilters: function(artifacts){
          var filters = [];

          _.each(artifacts, function(a){
              var oid = a.get('ObjectID'),
                  type = a.get('_type');

              if (type === 'testset'){
                  filters.push({
                      property: 'TestSets.ObjectID',
                      value: oid
                  });
              } else {
                  filters.push({
                      property: 'WorkProduct.ObjectID',
                      value: oid
                  });
              }
          });

          if (filters.length > 1){
              filters = Rally.data.wsapi.Filter.or(filters);
              this.logger.log('_getTestCaseFilters', filters.toString());
          } else {
            if (filters.length === 1){
               filters = Ext.create('Rally.data.wsapi.Filter',filters[0]);
            } else {
              filters = null;
            }
          }

          var queryFilters = this.getSetting('query') || null;
          if (queryFilters){
             queryFilters = Rally.data.wsapi.Filter.fromQueryString(this.getSetting('query'));
             if (filters){
                 filters = queryFilters.and(filters);
             } else {
               filters = queryFilters;
             }
          }

          var wsapiFilter = this.down('rallyinlinefilterbutton').getWsapiFilter();
          this.logger.log('wsapiFilter',wsapiFilter);
          if (wsapiFilter){
              if (filters){
                filters = wsapiFilter.and(filters);
              } else {
                filters = wsapiFilter;
              }
          }
          return filters || [];
      },
      _fetchTestCases: function(artifacts, operation){
          this.logger.log('_fetchTestCases', artifacts, operation);

          this.artifactRecords = artifacts;

          //TODO: check the number of artifacts.  We may want to consider chunking if this is too big....
          var filters = this._getTestCaseFilters(artifacts);

          this.logger.log('artifact filters', filters.toString());
          var noLastVerdictText = this.noLastVerdictText;
          var store = Ext.create('Rally.data.wsapi.Store', {
              model: 'TestCase',
              fetch: this.testCaseFetch,
              filters: filters,
              compact: false,
              pageSize: 2000,
              enablePostGet: true,
              groupField: 'LastVerdict',
              getGroupString: function(record) {
                  var verdict = record.get('LastVerdict');
                  return verdict || noLastVerdictText;
              }
          });

          store.on('load', this._buildSummaryGrid, this);

          this._buildGroupedGrid(store);

      },
      _buildSummaryGrid: function(store, testCaseRecords, operation){
          this.logger.log('_buildDisplay', testCaseRecords, store, _.map(testCaseRecords, function(tc){ return tc.get('FormattedID'); }));

          var casesRun = _.filter(testCaseRecords, function(tc){ return tc.get('LastVerdict')});
          this.logger.log('_mungeData', casesRun.length, testCaseRecords.length);

          var noLastVerdictText = this.noLastVerdictText;

          var colors = {}, idx = 0, total = 0;

          var verdictHash = _.reduce(testCaseRecords, function(vh, tc){
              var lastVerdict = tc.get('LastVerdict') || noLastVerdictText;
              if (!vh[lastVerdict]){
                 vh[lastVerdict] = 0;
                 colors[lastVerdict] = this.verdictColors[lastVerdict] || this.chartColors[idx++]
              }
              vh[lastVerdict]++;
              return vh;
          },{}, this);

          var data = [],
          total = Ext.Array.sum(Ext.Object.getValues(verdictHash));
          Ext.Object.each(verdictHash, function(key, val){
             data.push({
               key: key,
               count: val,
               color: colors[key],
               total: total
             });
          });

          //verdictHash.totalCases = testCaseRecords.length;
          this.logger.log('verdictHash', verdictHash);
          var series = [];

          Ext.Object.each(verdictHash, function(key, val){
             console.log('key', key, val);
             series.push({
               name: key,
               data: [val],
               color: colors[key]
             });
          }, this);

          series = Ext.Array.sort(series, function(a,b){
              if (a.name === "Pass"){
                return 1;
              }
              if (b.name === "Pass"){
                return -1;
              }
              if (a.name === "Fail"){
                return 1;
              }
              if (b.name === "Fail"){
                return -1;
              }
              if (a.name === noLastVerdictText){
                return -1;
              }
              return 1;
          });

  this.logger.log('series', series);
          this.getChartBox().removeAll();
          this.getChartBox().add({
            xtype: 'rallychart',
            chartData: {
              series: series
            },
            chartConfig: {
               chart: {
                 type: 'bar',
                 height: 150,
                 spacing: [0,0,0,0]
               },
               title: {
                 text: null
               },
               legend: {
                  layout: 'vertical',
                  align: 'right'
                },
               yAxis: {
                   visible: false,
                   gridLineWidth: 0,
                   labels: {
                     enabled: false
                   },
                   title: {
                     text: null
                   },
                   lineWidth: 0
               },
               xAxis: {
                   visible: false,
                   gridLineWidth: 0,
                   labels: {
                     enabled: false
                   },
                   title: {
                     text: null
                   },
                   lineWidth: 0
               },
               legend: {
                 itemStyle: {
                        color: '#444',
                        fontFamily:'ProximaNova',
                        textTransform: 'uppercase'
                },
                borderWidth: 0,
                reversed: true
               },
               tooltip: {
                 backgroundColor: '#444',
                 headerFormat: '', //'<span style="display:block;margin:0;padding:0 0 2px 0;text-align:center"><b style="font-family:NotoSansBold;color:white;">{point.key}</b></span><table><tbody>',
                 footerFormat: '', //'</tbody></table>',
                 pointFormat: '<div class="tooltip-label"><span style="color:{series.color};width=100px;">\u25CF</span><b>{point.percentage:.1f}% {series.name}</b><br/><div class="tooltip-point">{point.y} Test Cases</div>',
                 useHTML: true,
                 borderColor: '#444'
                },
               plotOptions: {
                   series: {
                       stacking: 'normal',
                       dataLabels: {
                           enabled: true,
                           format: '{percentage:.1f} %',
                           style: {
                              color: '#FFFFFF',
                              fontFamily:'ProximaNovaBold',
                              fontWeight: 'bold'
                          }
                       }
                   }
               },
             }
          });
          //this.down('#ct-summary').update(data);
      },
      _buildGroupedGrid: function(store){
          this.logger.log('_buildGroupedGrid', store);
          this.getGridBox().removeAll();

          if (store && store.totalCount > 2000){
              Rally.ui.notify.Notifier.showWarning({
                  message: Ext.String.format("{0} Test Cases were found, but only 2000 are shown.", store.totalCount)
              });
          }

          this.getGridBox().add({
              xtype: 'rallygrid',
              store: store,
              itemId: 'grouped-grid',
              margin: 10,
              pageSize: 2000,
              columnCfgs: this._getColumnCfgs(),
              features: [{ftype:'grouping'}],
          });
      },
      _getColumnCfgs: function(){
          var artifact_hash = {};
          _.each(this.artifactRecords, function(r){
              artifact_hash[r.get('FormattedID')] = r;
          });

          this.logger.log('artifactHash', artifact_hash);
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
              renderer: function(v,m,r){

                  var unknownText = "--";
                  if (v){
                      var rec = artifact_hash[v.FormattedID];
                      if (rec){
                          return Ext.String.format('<a href="{0}">{1}</a>: {2}',Rally.nav.Manager.getDetailUrl(rec), v.FormattedID,rec.get('Name'));
                      }
                  }

                  if (r.get('Summary') && r.get('Summary').TestSets){

                      var fids = _.keys(r.get('Summary').TestSets.FormattedID),
                          testSets = [];

                      for (var i=0; i< fids.length; i++){
                          if (artifact_hash[fids[i]]){
                              testSets.push(Ext.String.format('<a href="{0}">{1}</a>: {2}',Rally.nav.Manager.getDetailUrl(artifact_hash[fids[i]]),fids[i],artifact_hash[fids[i]].get('Name')));
                          }
                      }
                      if (testSets.length > 0){
                          return testSets.join('<br/>');
                      }
                  }
                  return unknownText;
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

          file_util.getCSVFromGrid(this, this.down('rallygrid'),this._getExportColumnCfgs()).then({
              success: function(csv){
                  this.setLoading(false);
                  file_util.saveCSVToFile(csv, 'export.csv');
              },
              scope: this
          });
      },
      _getExportColumnCfgs: function(){
          var artifact_hash = {},
              releaseName = this.getReleaseTimeboxRecord().get('Name');

          _.each(this.artifactRecords, function(r){
              artifact_hash[r.get('FormattedID')] = r;
          });

          this.logger.log('artifactHash', artifact_hash);
          return [{
              dataIndex: 'LastVerdict',
              text: 'Last Verdict'
          },{
              dataIndex: 'FormattedID',
              text: 'ID'
          },{
              dataIndex: 'Name',
              text: 'Test Case'
          },{
              dataIndex: 'WorkProduct',
              text: 'Work Item ID',
              renderer: function(v,m,r){

                  var unknownText = "--";
                  if (v && artifact_hash[v.FormattedID]){
                      return v.FormattedID;
                  }

                  if (r.get('Summary') && r.get('Summary').TestSets){

                      var fids = _.keys(r.get('Summary').TestSets.FormattedID),
                          testSets = [];

                      for (var i=0; i< fids.length; i++){
                          if (artifact_hash[fids[i]]){
                              testSets.push(fids[i]);
                          }
                      }
                      if (testSets.length > 0){
                          return testSets.join(',');
                      }
                  }
                  return unknownText;
              }
          }, {
              dataIndex: 'WorkProduct',
              text: 'Work Item Name',
              renderer: function (v, m, r) {

                  var unknownText = "--";
                  if (v) {
                      var rec = artifact_hash[v.FormattedID];
                      if (rec) {
                          return rec.get('Name');
                      }
                  }

                  if (r.get('Summary') && r.get('Summary').TestSets) {

                      var fids = _.keys(r.get('Summary').TestSets.FormattedID),
                          testSets = [];

                      for (var i = 0; i < fids.length; i++) {
                          if (artifact_hash[fids[i]]) {
                              testSets.push(artifact_hash[fids[i]].get('Name'));
                          }
                      }
                      if (testSets.length > 0) {
                          return testSets.join(',');
                      }
                  }
                  return unknownText;
              }
          },{
              dataIndex: 'LastRun',
              text: 'Last Tested'
          },{
              dataIndex: 'Owner',
              text: 'Owner',
              renderer: function(v,m,r){
                  return (v && (v.FirstName || '') + ' ' + (v.LastName || '')) || '(No Owner)';
              }
          },{
              dataIndex: 'Project',
              text: 'Project',
              renderer: function(v,m,r){
                  return v && v.Name || '';
              }
          },{
              dataIndex: 'Release',
              text: 'Release Name',
              renderer: function(v,m,r){
                  return releaseName;
              }
          },{
              dataIndex: 'LastBuild',
              text: 'Last Build'
          },{
              dataIndex: 'Method',
              text: 'Method'
          }];
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
      _getScopeSelectorStore: function(){
        return Ext.create('Rally.data.custom.Store',{
            fields: ['name','value'],
            data: [{
              name: 'Follow Dashboard Scope',
              value: 'dashboard'
            },{
              name: 'Release Selector inside App',
              value: 'rallyreleasecombobox'
            },{
              name: 'Iteration Selector inside App',
              value: 'rallyiterationcombobox'
            }]
        });
      },
      getSettingsFields: function(){
          return [{
            name: 'timeboxScopeSelector',
            xtype: 'rallycombobox',
            fieldLabel: 'Scope Selector Type',
            labelWidth: 150,
            width: 400,
            labelAlign: 'right',
            store: this._getScopeSelectorStore(),
            valueField: 'value',
            displayField: 'name'
          },{
            xtype: 'textarea',
            fieldLabel: 'Query Filter',
            name: 'query',
            anchor: '100%',
            cls: 'query-field',
            margin: '0 70 0 0',
            labelAlign: 'right',
            labelWidth: 150,
            plugins: [
                {
                    ptype: 'rallyhelpfield',
                    helpId: 194
                },
                'rallyfieldvalidationui'
            ],
            validateOnBlur: false,
            validateOnChange: false,
            validator: function(value) {
                try {
                    if (value) {
                        Rally.data.wsapi.Filter.fromQueryString(value);
                    }
                    return true;
                } catch (e) {
                    return e.message;
                }
            }
          }];

      }
  });
