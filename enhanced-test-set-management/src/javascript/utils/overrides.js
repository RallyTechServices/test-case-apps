
Ext.define('Rally.ui.menu.item.EnhancedAddTestCaseMenuItem', {
       extend: 'Rally.ui.menu.item.RecordMenuItem',
       alias: 'widget.rallyrecordmenuitemenhancedaddtestcase',

       mixins : {
           messageable : 'Rally.Messageable'
       },

       config: {
           text: 'Add Existing Test Cases...',
           cls: 'artifact-icon icon-test-case',
           predicate: function(record) {
            return record.get('_type') === 'testset';
        },

        handler: function() {
            this._onAddTestCaseClicked(this.record);
        },

       },

       _onAddTestCaseClicked: function() {
         var targetEl = Ext.get(this.owningEl || this.getEl());

         Ext.create('CA.ts.testcaseapps.dialog.AddTestCaseDialog',{
            height: Rally.getApp().getHeight() * .75,
            width: Rally.getApp().getWidth() * .75,
            listeners: {
                itemselected: this.updateTestSets,
                scope: this
            }
         }).show();
       },
       updateTestSets: function(testCases){
        console.log('updateTestSets', testCases, this.record);

        var testCaseStore = this.record.getCollection('TestCases');
        testCaseStore.load({
            callback: function() {
                testCaseStore.add(testCases);
                testCaseStore.sync({
                    success: this._onSuccess,
                    failure: this._onFailure,
                    callback: this._onCallback,
                    scope: this

                });
            },
            scope: this
        });
       },

         _onSuccess: function(store) {

             var updatedRecord = this.record.copy();
             updatedRecord.self.load(updatedRecord.getId(), {
                 callback: function(record) {
                     this.publish(Rally.Message.objectUpdate, record, 'TestCases', this);
                     Rally.ui.notify.Notifier.showUpdate({artifact: this.record});
                 },
                 scope: this
             });
         },

         _onFailure: function(record, operation) {
             Rally.data.util.Record.showWsapiErrorNotification(this.record, operation);
         },
         _onCallback: function() {
             Ext.callback(this.afterAction, this.actionScope, [this.record]);
         }
   });
