Ext.define("release-test-coverage", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    integrationHeaders : {
        name : "release-test-coverage"
    },

    onScopedDashboard: false,

    artifactModels: ['Defect', 'UserStory','TestSet'],
    artifactFetch: ['ObjectID','Project','FormattedID','Name','TestCases','ScheduleState','Owner', 'FirstName','LastName','UserName'],
    testCaseFetch: ['FormattedID','Name','LastVerdict','ObjectID','WorkProduct','Owner','LastRun','FirstName','LastName','TestSets:summary[FormattedID]','Method','LastBuild','Project'],
    notTestedText: 'Not Tested',

    chartColors: [ '#2f7ed8', '#8bbc21', '#910000'],


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

            var tpl = new Ext.XTemplate('<div class="coverageTitle"><b>{workItemsCoveragePercent} %</b> of work items have test coverage ({workItemsCoverage} / {workItemsTotal})</div>',
                            '<div class="tslegend" style="background-color:#8bbc21;">&nbsp;&nbsp;</div><div class="tslegendtext">&nbsp;&nbsp;User Stories</div><span class="tslegendspacer">&nbsp;</span></div>',
                '<div class="tslegend" style="background-color:#c42525">&nbsp;&nbsp;</div><div class="tslegendtext">&nbsp;&nbsp;Defects</div><span class="tslegendspacer">&nbsp;</span></div>',
                '<div class="tslegend" style="background-color:#2f7ed8">&nbsp;&nbsp;</div><div class="tslegendtext">&nbsp;&nbsp;TestSets</div><span class="tslegendspacer">&nbsp;</span></div>',
                  '<div class="tslegend" style="background-color:#ccc">&nbsp;&nbsp;</div><div class="tslegendtext">&nbsp;&nbsp;No Coverage</div><span class="tslegendspacer">&nbsp;</span></div>'

            );

            header.add({
                xtype: 'container',
                itemId: 'ct-summary',
                tpl: tpl,
                margin: '0 100 0 75',
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

        var store = Ext.create('Rally.data.wsapi.artifact.Store', {
            models: this.artifactModels,
            fetch: this.artifactFetch,
            filters: filters,
            sorters: [{
                property: 'FormattedID',
                direction: 'ASC'
            }]
        }).load({
            callback: this._processData,
            scope: this
        });
    },
    _processData: function(records, operation, success){
        this.logger.log('_updateDisplay', records);

        var missingTestCases = [],
            totalCount = {
                hierarchicalrequirement: 0,
                defect: 0,
                testset: 0
            },
            hasTestCasesCount = {
                hierarchicalrequirement: 0,
                defect: 0,
                testset: 0
            };

        _.each(records, function(r){
            var type = r.get('_type').toLowerCase();
            totalCount[type]++;
            if (!(r.get('TestCases') &&  r.get('TestCases').Count > 0)){
                missingTestCases.push(r);
            } else {
                hasTestCasesCount[type]++;
            }
        });


        this.logger.log('totalCount, hasTestCasesCount, missingTestCases, totalCount', totalCount, hasTestCasesCount, missingTestCases.length, records.length);

        var totalHasTestCasesCount = Ext.Array.sum(_.values(hasTestCasesCount));
        this._buildSummary(totalHasTestCasesCount, records.length);

        this._buildChart(hasTestCasesCount, totalCount);

        this._buildMissingTestCasesGrid(missingTestCases);
    },
    _buildChart: function(hasTestCasesCountHash, totalCountHash){
        this.logger.log('_buildChart');

            var categories = ['User Stories', 'Defects', 'TestSets'],
            series = [{
                name: 'w/o Coverage',
                data: [{y: totalCountHash.hierarchicalrequirement - hasTestCasesCountHash.hierarchicalrequirement, color: '#ccc', borderColor: '#ccc'}, {y:totalCountHash.defect - hasTestCasesCountHash.defect, color: '#ccc', borderColor: '#ccc'},{y:totalCountHash.testset - hasTestCasesCountHash.testset, color: '#ccc', borderColor: '#ccc'}]
            },{
                name: 'w/ Coverage',
                data: [{y: hasTestCasesCountHash.hierarchicalrequirement, color: '#8bbc21', borderColor: '#8bbc21'}, {y: hasTestCasesCountHash.defect, color: '#c42525', borderColor: '#c42525'},{y: hasTestCasesCountHash.testset, color: '#2f7ed8', borderColor: '#2f7ed8'}]

            }];

           if (this.down('#summary-chart')){
                this.down('#summary-chart').destroy();
            }
            var chart = this.add({
                xtype: 'rallychart',
                chartColors: ['#CCC', '#c42525','#8bbc21','2f7ed8'],
                itemId: 'summary-chart',
                loadMask: false,
                margin: 25,
                height: 200,
                chartData: {
                    series: series,
                    categories: categories
                },
                chartConfig: {
                    chartColors: ['#CCC', '#2f7ed8'],
                    chart: {
                        type: 'column'
                    },
                    title: {
                        text: null
                    },
                    xAxis: {
                        categories: categories
                    },
                    yAxis: {
                        min: 0,
                        title: {
                            text: 'Total Work Items'
                        },
                        stackLabels: {
                            enabled: true,
                            style: {
                                fontWeight: 'bold',
                                color: 'white'
                            }
                        }
                    },
                    legend: {
                        enabled: false,
                        align: 'right',
                        backgroundColor: 'white',
                        borderColor: '#CCC',
                        borderWidth: 1,
                        shadow: false,
                        align: 'right',
                        verticalAlign: 'center',
                        layout: 'vertical',
                        floating: false
                    },
                    tooltip: {
                        headerFormat: '<b>{point.x}</b><br/>',
                        pointFormat: '{point.y} of {point.stackTotal} {series.name} (<b>{point.percentage::.1f} %</b>)</br>'
                    },
                    plotOptions: {
                        series: {
                            //borderColor: '#303030',
                            pointWidth: 30
                        },
                        column: {
                            stacking: 'normal',
                            dataLabels: {
                                enabled: false
                            }
                        }
                    }
                }
            });





    },
    _buildMissingTestCasesGrid: function(records){
        this.logger.log('_buildMissingTestCasesGrid');

        if (this.down('#missing-grid')){
            this.down('#missing-grid').destroy();
        }

        this.add({
            xtype: 'rallygrid',
            store: Ext.create('Rally.data.custom.Store',{
                data: records,
                pageSize: records.length
            }),
            itemId: 'missing-grid',
            margin: 25,
            columnCfgs: this._getColumnCfgs(),
            showPagingToolbar: false
        });

        console.log('store',this.down('rallygrid').getStore());
    },
    _buildSummary: function(hasTestCaseCount, totalCount){
        this.logger.log('_buildDisplay', hasTestCaseCount, totalCount);

        var pct = totalCount > 0 ? Math.round(hasTestCaseCount/totalCount * 100) : 0;
        this.down('#ct-summary').update({workItemsCoveragePercent: pct, workItemsCoverage: hasTestCaseCount, workItemsTotal: totalCount});
    },
    _getColumnCfgs: function(){
        var noOwnerText = '(No Owner)';
        return [{
            dataIndex: 'FormattedID',
            text: 'ID',
            flex: 1,
            renderer: function(v,m,r){
                if (r){
                    return Ext.String.format('<a href="{0}">{1}</a>',Rally.nav.Manager.getDetailUrl(r), v,r.get('Name'));
                }
            },
            exportRenderer: function(v,m,r){
                return v;
            }
        }, {
            dataIndex: 'Name',
            text: 'Name',
            flex: 4
        },{
            dataIndex: 'ScheduleState',
            text: 'ScheduleState',
            flex: 1
        },{
            dataIndex: 'Owner',
            text: 'Owner',
            renderer: function(v){
                var ownerName = noOwnerText;
                if (v){
                    if (v.FirstName || v.LastName){
                        ownerName = v.FirstName + ' ' + v.LastName;
                    } else {
                        ownerName = v.UserName || noOwnerText;
                    }
                }
                return ownerName;

            },
            flex: 2
        }];
    },
    _export: function(){
        var file_util = Ext.create('Rally.technicalservices.FileUtilities',{});
        var csv = file_util.getCSVFromData(this, this.down('rallygrid'),this._getColumnCfgs());
        var file_name = Ext.String.format('missing-test-cases-{0}.csv',Rally.util.DateTime.format(new Date(), 'Y-m-d-H-i-s'));
        file_util.saveCSVToFile(csv, file_name );

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
