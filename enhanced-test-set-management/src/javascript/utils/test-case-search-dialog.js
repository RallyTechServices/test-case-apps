Ext.define('CA.ts.testcaseapps.dialog.AddTestCaseDialog',{
  extend: 'Rally.ui.dialog.Dialog',
  alias: 'widget.catstestcasesearchdialog',

   mixins: {
       messageable: 'Rally.Messageable',
       clientMetrics: 'Rally.clientmetrics.ClientMetricsRecordable'
   },

   layout: 'fit',
    closable: true,
    draggable: true,
    resizable: true ,

    config: {
        title: 'Select Test Cases',
        selectionButtonText: 'Add'
    },

    /**
     * @abstract {Function}
     * Builds and adds the chooser component for the given implementation.
     * @return chooser {Ext.Component}
     */
    buildChooser: Ext.emptyFn,
    controller: 'Rally.ui.dialog.AbstractChooserDialogController',
    constructor: function(config) {
        this.mergeConfig(config);
        this.callParent(arguments);
    },
    initComponent: function() {
        this.callParent(arguments);
        this.addCls(['chooserDialog', 'chooser-dialog']);
        this._buildButtons();
        this._buildSelectors();
        this._createChooser();
    },
    onSelectButtonClick: function(){
        this.fireEvent('itemselected', this.getSelectedTestCases());
        this.destroy();
    },
    getSelectedTestCases: function(){
       return this.selectedRecords || [];
    },
    onCancelButtonClick: function() {
      this.destroy();
    },
    _createChooser: function() {
        chooser = this.buildChooser();
        if (chooser) {
            this.mon(chooser, 'ready', function() {
                this.fireEvent('ready', this);
            }, this);
        } else {
            this.fireEvent('ready', this);
        }

        var ct = this.add({
          xtype: 'container',
          itemId: 'gridBox',
          tpl:'<tpl>{message}</tpl>',
          cls: 'rui-info-label'
        });
        ct.update({message: 'Please select a type of search and enter search terms'});

        return chooser;
    },
    buildChooser: function(){
       return null;
    },
    /**
     * @private
     */
    _buildSelectors: function(){


      this.addDocked({
          xtype: 'toolbar',
          itemId: 'searchBar',
          layout: {
             type: 'hbox'
          },
          dock: 'top',
          border: false,
          padding: '0 0 10px 0',
          items: [{
             xtype: 'rallybutton',
             iconCls: 'icon-folder',
             itemId: 'TestFolder',
             enableToggle: true,
             pressed: true,
             cls: 'rly-small primary',
             toggleGroup: 'searchType',
             listeners: {
                scope: this,
                toggle: this._toggleState
             }
          },{
             xtype: 'rallybutton',
             iconCls: 'icon-story',
             enableToggle: true,
             toggleGroup: 'searchType',
             cls: 'rly-small secondary',
             itemId: 'HierarchicalRequirement',
             listeners: {
                scope: this,
                toggle: this._toggleState
             }
           },{
              xtype: 'rallybutton',
              iconCls: 'icon-test',
              itemId: 'TestCase',
              enableToggle: true,
              toggleGroup: 'searchType',
              cls: 'rly-small secondary',
              listeners: {
                 scope: this,
                 toggle: this._toggleState
              }
          },{
            xtype: 'triggerfield',
             cls: 'rui-triggerfield chooser-search-terms',
             emptyText: 'Search Keyword or ID',
             enableKeyEvents: true,
             flex: 1,
             itemId: 'searchTerms',
             listeners: {
                 keyup: function (textField, event) {
                     if (event.getKey() === Ext.EventObject.ENTER) {
                         this._search();
                     }
                 },
                 afterrender: function (field) {
                     field.focus();
                 },
                 scope: this
             },
             triggerBaseCls: 'icon-search chooser-search-icon'
          },{
            xtype: 'rallybutton',
             cls: 'rly-small primary',
             iconCls: 'icon-search',
             listeners: {
               click: this._search,
               scope: this
             }
          }]
      });


    },
    _toggleState: function(bt, pressed){
      if (bt){
        if (pressed){
            bt.removeCls('secondary');
            bt.addCls('primary');

            if (this.down('#searchTerms').getValue()){
               this._search();
            }
        } else {
          bt.removeCls('primary');
          bt.addCls('secondary');
        }
      }
    },
    getSearchType: function(){
        var bts = this.query('rallybutton[toggleGroup="searchType"]');
        var type = null;
        Ext.Array.each(bts, function(b){
           if (b.pressed){
              type = b.itemId;
              return false;
           }
        });
        return type;
    },
    getProject: function(){
       return null;
    },
    _clearGridBox: function(){
      this.down('#gridBox').removeAll();
      this.down('#gridBox').update({message: ""});
      this.selectedRecords = [];
    },
    _buildStorySearchGrid: function(terms, project){
        var filters = [{
          property: 'WorkProduct.Name',
          operator: 'contains',
          value: terms
        },{
          property: 'WorkProduct.FormattedID',
          value: terms
        }];

        filters = Rally.data.wsapi.Filter.or(filters);

        this.down('#gridBox').add({
           xtype: 'rallygrid',
           storeConfig: {
             model: 'TestCase',
             filters: filters,
             fetch: ['ObjectID','Name','FormattedID','TestFolder','Project','Type','WorkProduct'],
             context: {
                project: project,
                projectScopeDown: true
             },
             enablePostGet: true,
             autoLoad: true,
             pageSize: 2000
           },
           selModel: Ext.create('Rally.ui.selection.CheckboxModel'),
           columnCfgs: ['FormattedID','Name','TestFolder','Project','Type','WorkProduct'],
           showRowActionsColumn: false,
           height: this.down('#gridBox').getHeight(),
           showPagingToolbar: true,
           listeners: {
              scope: this,
              beforeselect: this._onGridSelect,
              beforedeselect: this._onGridDeselect,
           },
           pagingToolbarCfg: {
             pageSizes: [100,500,1000,2000]
           }
        });
    },
    _buildTestFolderSearchGrid: function(terms, project){
        var tfFilters = [],
            tcFilters = [];

        var MAX_FOLDER_LEVELS = 12;

        var properties = ["Name"];
        for (var i=0; i<MAX_FOLDER_LEVELS; i++){
           tfFilters.push({
              property: properties.join('.'),
              operator: 'contains',
              value: terms
           });
           tcFilters.push({
              property: "TestFolder." + properties.join('.'),
              operator: 'contains',
              value: terms
           });
           properties.unshift("Parent");
        }

        tcFilters = Rally.data.wsapi.Filter.or(tcFilters);
        tfFilters = Rally.data.wsapi.Filter.or(tfFilters);
        this.setLoading(true);
        Deft.Promise.all([
          this._fetchWsapiRecords({
            model: 'TestFolder',
            filters: tfFilters,
            fetch: ['Name','Parent','FormattedID','ObjectID','Project']
          }),
          this._fetchWsapiRecords({
            model: 'TestCase',
            filters: tcFilters,
            fetch: ['Name','TestFolder','FormattedID','ObjectID','Project','Type']
          })
        ]).then({
           success: this._buildTestFolderTreeStore,
           failure: this._onError,
           scope: this
        }).always(function(){
           this.setLoading(false);
        },this);
    },
    _onError: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    _buildTestFolderTreeStore: function(results){
      this._buildTestFolderTree(results[0],results[1]);
    },
    _buildTestFolderTree: function(testFolders, testCases){
      var testFolderHash =  _.reduce(testFolders, function(hash, r){
          hash[r.get('ObjectID')] = r.getData();
          //hash[r.get('ObjectID')].checked = false;
          return hash;
      }, {});

     for (var i=0; i<testCases.length; i++){
         var tc = testCases[i].getData(),
            tf = tc.TestFolder && tc.TestFolder.ObjectID;
            tc.leaf = true
            tc.checked = false;
         if (!testFolderHash[tf].children){
            testFolderHash[tf].children = [];
         }
         testFolderHash[tf].children.push(tc)
     }

     var root = [];
     _.forEach(testFolderHash, function(tf, key){
          var tfp = tf.Parent && tf.Parent.ObjectID && testFolderHash[tf.Parent.ObjectID] || null;
          if (tfp){
            if (!testFolderHash[tfp.ObjectID].children){
               testFolderHash[tfp.ObjectID].children = [];
            }
            testFolderHash[tfp.ObjectID].children.push(tf);
          } else {
             root.push(tf);
          }
     });

     var tree_store = Ext.create('Ext.data.TreeStore',{
         model: 'TestFolderTreeModel',
         root: {
             expanded: false,
             children: root
         }
     });

     var tree = this.down('#gridBox').add({
         xtype:'treepanel',
         store: tree_store,
         cls: 'rally-grid',
         rootVisible: false,
         enableColumnMove: true,
         sortableColumns: false,
         rowLines: true,
         height: this.down('#gridBox').getHeight(),
         columns: this._getTreeColumns(),
         listeners: {
            scope: this,
            checkchange: this._onChecked
         }
     });
    },
    _onChecked: function(record, checked){
       if (checked){
         this.selectedRecords.push(record.get('_ref'));
       } else {
         var index = this.selectedRecords.indexOf(record.get('_ref'));
         if (index > -1) {
           this.selectedRecords.splice(index, 1);
         }
       }
       this._enableButtons();
    },
    _onGridSelect: function(grid,record){
       this._onChecked(record, true);
    },
    _onGridDeselect: function(grid,record){
       this._onChecked(record, false);
    },
    _enableButtons: function(selectedCount){
        var disable = true;
        if (this.selectedRecords && this.selectedRecords.length > 0){
            disable = false;
        }
        this.down('#selectButton').setDisabled(disable);
    },
    _getTreeColumns: function(){
        return [
            {
                xtype: 'treecolumn',
                text: 'Item',
                dataIndex: 'Name',
                itemId: 'tree_column',
                renderer: this._nameRenderer,
                menuDisabled: true,
                otherFields: ['FormattedID','ObjectID'],
                flex: 1
            },{
              text:'Type',
              dataIndex:'Type',
              menuDisabled: true
            },{
              text:'Project',
              dataIndex:'Project',
              menuDisabled: true,
              renderer: function(v,m,r){
                  if (Ext.isObject(v)){
                     return v._refObjectName;
                  }
                  return v;
              }
            }];
    },
    _nameRenderer: function(value,meta_data,record) {

        var display_value = record.get('Name');
        if ( record.get('FormattedID') ) {
            var url = Rally.nav.Manager.getDetailUrl( record );
            var typeInfo = Rally.util.TypeInfo.getTypeInfoByName(record.get('_type')),
            className = typeInfo && typeInfo.icon;

            display_value = '<span class="formatted-id-template"><span class="artifact-icon ' + className + '"></span><a target="_blank" href="' + url + '">' + record.get('FormattedID') + '</a>: </span>' + record.get('Name');
        }
        return display_value;
    },
    _buildTestCaseSearchGrid: function(terms, project){
      var filters = [{
         property: 'Name',
         operator: 'contains',
         value: terms
      },{
         property: 'FormattedID',
         value: terms
      }];

      filters = Rally.data.wsapi.Filter.or(filters);

      this.down('#gridBox').add({
         xtype: 'rallygrid',
         storeConfig: {
           model: 'TestCase',
           filters: filters,
           fetch: ['ObjectID','Name','FormattedID','TestFolder','Project','Type'],
          //  context: {
          //     project: project,
          //     projectScopeDown: true
          //  },
           autoLoad: true,
           pageSize: 2000
         },
         selModel: Ext.create('Rally.ui.selection.CheckboxModel'),
         columnCfgs: ['FormattedID','Name','TestFolder','Project','Type'],
         showRowActionsColumn: false,
         height: this.down('#gridBox').getHeight(),
         showPagingToolbar: true,
         listeners: {
            scope: this,
            beforeselect: this._onGridSelect,
            beforedeselect: this._onGridSelect,
         },
         pagingToolbarCfg: {
           pageSizes: [100,500,1000,2000]
         }
      });

    },
    _updateMessage: function(msg){
      this.down('#gridBox').removeAll();
      this.down('#gridBox').update({message: msg});
    },
    _search: function(){
      var searchTerms = this.down('#searchTerms').getValue(),
          searchType = this.getSearchType(),
          project = this.getProject();
      this._clearGridBox();

      switch(searchType){
          case 'HierarchicalRequirement':
            this._buildStorySearchGrid(searchTerms, project);
            break;
          case 'TestFolder':
            this._buildTestFolderSearchGrid(searchTerms, project);
            break;
          case 'TestCase':
            this._buildTestCaseSearchGrid(searchTerms, project);
            break;
          default:
            this._updateMessage("Choose a type to search for (Test Folder, User Story, or Test Case)");
      }
    },
    _buildButtons: function() {
        this.addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [{
                xtype: 'rallybutton',
                itemId: 'selectButton',
                text: this.getSelectionButtonText(),
                cls: 'primary rly-small',
                disabled: true,
                margin: 8,
                listeners: {
                   click: this.onSelectButtonClick,
                   scope: this
                }
            },{
                xtype: 'rallybutton',
                itemId: 'cancelButton',
                text: 'Cancel',
                cls: 'secondary rly-small',
                ui: 'link',
                margin: 8,
                listeners: {
                   click: this.onCancelButtonClick,
                   scope: this
                }
            }]
        });
    },
    _fetchWsapiRecords: function(config){
      var deferred = Ext.create('Deft.Deferred');
      var me = this;

      if (!config.limit){ config.limit = "Infinity"; }
      if (!config.pageSize){ config.pageSize = 2000; }

      Ext.create('Rally.data.wsapi.Store', config).load({
          callback : function(records, operation, successful) {
              if (successful){
                  deferred.resolve(records);
              } else {
                  deferred.reject('Problem fetching: ' + operation.error.errors.join('. '));
              }
          }
      });
      return deferred.promise;
    }
   });
