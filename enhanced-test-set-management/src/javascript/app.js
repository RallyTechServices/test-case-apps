Ext.define("enhanced-test-set-mgmt", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "enhanced-test-set-mgmt"
    },

    config: {
      defaultSettings: {
         type: 'TestSet'
      }
    },

    launch: function() {
        this._buildStore();
    },
    _buildStore: function(){

        this.modelNames = [this.getSetting('type')];
        this.logger.log('_buildStore', this.modelNames);
        var fetch = ['FormattedID', 'Name'];

        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: this.modelNames,
            enableHierarchy: true,
            fetch: fetch
        }).then({
            success: this._addGridboard,
            scope: this
        });
    },
    _addGridboard: function(store) {

        if (this.down('#display_box')){
            this.down('#display_box').removeAll();
        }

        var filters = this.getSetting('query') ? Rally.data.wsapi.Filter.fromQueryString(this.getSetting('query')) : [];
        this.logger.log('_addGridboard', store);


        this.gridboard = this.down('#display_box').add({
                xtype: 'rallygridboard',
                context: this.getContext(),
                modelNames: this.modelNames,
                toggleState: 'grid',
                plugins: [
                    'rallygridboardaddnew',
                    {
                        ptype: 'rallygridboardinlinefiltercontrol',
                        inlineFilterButtonConfig: {
                            stateful: true,
                            stateId: this.getContext().getScopedStateId('filters-1'),
                            modelNames: this.modelNames,
                            inlineFilterPanelConfig: {
                                quickFilterPanelConfig: {
                                    whiteListFields: [
                                       'Tags',
                                       'Milestones'
                                    ],
                                    defaultFields: [
                                        'ArtifactSearch',
                                        'Owner',
                                        'ModelType',
                                        'Milestones'
                                    ]
                                }
                            }
                        }
                    },
                    {
                        ptype: 'rallygridboardfieldpicker',
                        headerPosition: 'left',
                        modelNames: this.modelNames
                        //stateful: true,
                        //stateId: this.getContext().getScopedStateId('columns-example')
                    }
                ],
                cardBoardConfig: {
                    attribute: 'ScheduleState'
                },
                gridConfig: {
                    store: store,
                    storeConfig: {
                        filters: filters
                    },
                    rowActionColumnConfig: {
                      rowActionsFn: function (record) {
                          return [
                              {
                                  xtype: 'rallyrecordmenuitemenhancedaddtestcase',
                                  record: record
                              }
                          ];
                      }
                    },
                    columnCfgs: [
                        'Name'
                    ]
                },

                height: this.getHeight()
        });
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
