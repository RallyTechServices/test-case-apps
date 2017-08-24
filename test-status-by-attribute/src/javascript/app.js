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
    _initializeApp: function(){
        Deft.Promise.all([
            Rally.technicalservices.WsapiToolbox.fetchModelFields('TestSet'),
            Rally.technicalservices.WsapiToolbox.fetchModelFields('Artifact'),
            Rally.technicalservices.WsapiToolbox.fetchModelFields('TestCase')
        ]).then({
            success: function(results){
                this._initailizeYAxisOptions(results[0],results[1], results[2]);
                this._initializeDisplay();
            },
            failure: this._showErrorNotification,
            scope: this
        });
    },
    _initailizeYAxisOptions: function(testSetFields, artifactFields, testCaseFields){
        var yAxisOptions = [];

        Ext.Array.each(testCaseFields, function(f){
            if ((f.attributeDefinition && f.attributeDefinition.Constrained) ||
                f.name === 'TestFolder'){
              yAxisOptions.push({
                 displayName: 'TestCase: ' + f.displayName,
                 modelName: 'TestCase',
                 fieldName: f.name,
                 queryName: f.name
              })
            }
        });

        Ext.Array.each(testSetFields, function(f){
            if ((f.attributeDefinition && f.attributeDefinition.Constrained) || f.name === 'Name'){
              yAxisOptions.push({
                 displayName: 'TestSet: ' + f.displayName,
                 modelName: 'TestSet',
                 fieldName: f.name,
                 queryName: 'TestSets.' + f.name
              })
            }
        });

        Ext.Array.each(artifactFields, function(f){
            if ((f.attributeDefinition && f.attributeDefinition.Constrained) || f.name === 'Name'){
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
           fieldLabel: 'Y Axis Field',
           labelWidth: 100,
           displayField: 'displayName',
           valueField: 'queryName'
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
    },
    _updateDisplay: function(){
       var yAxisModelName = this.getYAxisModelName(),
           yAxisField = this.getYAxisFieldName();
       this.logger.log('_updateDisplay');

       this._fetchData().then({
           success: this._buildGrid,
           failure: this._showErrorNotification,
           scope: this
       });

    },
    getYAxisFields: function(){
        var yAxisFields = [];
        var y = this.down('#yAxisField').getRecord();
        if (y.get('modelName') === 'WorkProduct'){
           yAxisFields.push('WorkProduct');
        }
        yAxisFields.push(y.get('fieldName'));
        return yAxisFields;
    },
    getYAxisModelName: function(){
      var y = this.down('#yAxisField').getStore().find('displayName',this.down('#yAxisField').getValue());
      return y.get('modelName');
    },
    getFilters: function(){
       if (this.getYAxisModelName() === 'WorkProduct'){
          return [{
             property: 'WorkProduct.ObjectID',
             operator: '>',
             value: 0
          }];
       }
       if (this.getYAxisModelName() === 'TestSet'){
          return [{
             property: 'TestCases.ObjectID',
             operator: '>',
             value: 0
          }];
       }
       return [];
    },
    _fetchData: function(){

        if (this.getYAxisModelName() === 'TestSet'){
            //we need to load test sets and then test cases.
            return Rally.technicalservices.WsapiToolbox.fetchWsapiRecords({
              model: 'TestSet',
              fetch: ['TestCases','ObjectID','Name'].concat(this.getYAxisFields()),
              filters: this.getFilters()
            });
        } else {
          return Rally.technicalservices.WsapiToolbox.fetchWsapiRecords({
              model: 'TestCase',
              fetch: ['LastVerdict','ObjectID'].concat(this.getYAxisFields()),
              filters: this.getFilters()
          });
        }
    },
    _buildGrid: function(records){
        this.logger.log('_buildGrid', records);
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
