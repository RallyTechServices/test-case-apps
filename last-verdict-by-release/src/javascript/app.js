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
    testCaseFetch: ['FormattedID','Name','LastVerdict','ObjectID','WorkProduct','Owner','LastRun'],

    launch: function() {
        this.logger.log('launch');
        var context = this.getContext();

        this.onScopedDashboard = this._hasScope();
        this._addComponents(this.onScopedDashboard);

        this.onTimeboxScopeChange(context.getTimeboxScope() || null);
    },
    _hasScope: function() {
        var context = this.getContext();
        return context.getTimeboxScope() && context.getTimeboxScope().getType() === this.scopeType;
    },

    onTimeboxScopeChange: function(timebox){
        this.logger.log('onTimeboxScopeChange', timebox);

    },
    getReleaseTimeboxRecord: function(){
        if (this.onScopedDashboard){
            return (this.getContext().getTimebox() && this.getContext().getTimebox().getRecord()) || null;
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
                    xtype: 'rallyreleasecombobox'
                });
            }

            header.add({
                xtype: 'rallybutton',
                text: 'Update',
                listeners: {
                    scope: this,
                    click: this._update
                }
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
    },
    _update: function(){
        this.logger.log('_update', this.getReleaseTimeboxRecord());

        var filters = Ext.create('Rally.data.wsapi.Filter',{
            property: 'Release.Name',
            value: this.getReleaseTimeboxRecord().get('Name')
        });


        //Get Artifacts associated with Release so that we have a hash of those
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
        //Get test cases and pull out only ones associated with Artifacts associated with the release.

    },
    _getTestCaseFilters: function(artifacts){
        var prefixHash = {};

        _.each(artifacts, function(a){
            var fid = a.get('FormattedID'),
                prefix = fid.replace(/[0-9]/g, ""),
                num = Number(fid.replace(/[^0-9]/g, ""));
            console.log('pn',prefix, num);
            if (!prefixHash[prefix]){
                prefixHash[prefix] = { min: null, max: null};
            }
            if (prefixHash[prefix].min === null || prefixHash[prefix].min > num){
                prefixHash[prefix].min = num;
            }
            if (prefixHash[prefix].max === null || prefixHash[prefix].max < num){
                prefixHash[prefix].max = num;
            }
        });


        var filters = [];
        _.each(prefixHash, function(obj, prefix){
            var filter = Ext.create('Rally.data.wsapi.Filter',{
                property: 'WorkProduct.FormattedID',
                operator: '>',
                value: Ext.String.format('{0}{1}', prefix, obj.min)
            });
            filter = filter.and(Ext.create('Rally.data.wsapi.Filter',{
                property: 'WorkProduct.FormattedID',
                operator: '<',
                value: Ext.String.format('{0}{1}', prefix, obj.max)
            }));
            filters.push(filter);
        });
        filters = Rally.data.wsapi.Filter.or(filters);
        this.logger.log('_getTestCaseFiltesr', filters.toString());
        return filters;

    },
    _fetchTestCases: function(artifacts, operation){
        this.logger.log('_fetchTestCases', artifacts, operation);

        var formatted_ids = _.map(artifacts, function(a){ return a.get('FormattedID'); });
        this.logger.log('formattedIds', formatted_ids);

        this.artifactRecords = artifacts;

        var filters = this._getTestCaseFilters(artifacts);

        this.logger.log('artifact filters', filters.toString());
        Ext.create('Rally.data.wsapi.Store',{
            model: 'TestCase',
            fetch: this.testCaseFetch,
            filters: filters

        }).load({
            callback: this._buildDisplay,
            scope: this
        });



    },
    _buildDisplay: function(testCaseRecords, operation){
        this.logger.log('_buildDisplay', testCaseRecords, operation);
        this.testCaseRecords = testCaseRecords;
    },
    _export: function(){},
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
