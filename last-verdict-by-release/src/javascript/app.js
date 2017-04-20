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
    testCaseFetch: ['FormattedID','Name','LastVerdict','ObjectID','WorkProduct','Owner','LastRun','FirstName','LastName','TestSets:summary[FormattedID]','Method','LastBuild','Project'],
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
        if (timebox && timebox.type === 'release'){
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

        if (filters && filters.length > 1){
            filters = Rally.data.wsapi.Filter.or(filters);
            this.logger.log('_getTestCaseFilters', filters.toString());
        }
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
          //  limit: 'Infinity',
            compact: false,
            pageSize: 2000,
            enablePostGet: true,
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
        this.logger.log('_buildDisplay', testCaseRecords, store, _.map(testCaseRecords, function(tc){ return tc.get('FormattedID'); }));

        var casesRun = _.filter(testCaseRecords, function(tc){ return tc.get('LastVerdict')});
        this.logger.log('_mungeData', casesRun.length, testCaseRecords.length);

        this.down('#ct-summary').update({casesRun: casesRun.length, totalCases: testCaseRecords.length});
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
