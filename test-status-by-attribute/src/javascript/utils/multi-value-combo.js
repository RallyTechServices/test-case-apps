/*
 * create a form field thing.
 */

Ext.define('Rally.technicalservices.MultiValueComboBox',{
    alias: 'widget.multivaluecombo',
    extend: 'Ext.form.FieldContainer',

    mixins: {
        field: 'Ext.form.field.Field'
    },

    cls: 'multistate',

    config: {
        /**
         * @cfg {String}
         * The label for the field to be passed through to the combobox
         */
        fieldLabel: '',
        modelName: undefined,
        fieldName: undefined,
        value: undefined
    },
    refreshField: function(fieldName){
        this.fieldName = fieldName;
        this._initCombobox();
    },
    setModel: function(modelName){
        this.fieldName = "";
        this.modelName = modelName;
        this._initCombobox();
    },
    refreshFieldAndModel: function(fieldName, modelName){
      this.fieldName = fieldName;
      this.modelName = modelName;
      this._initCombobox();
    },
    initComponent: function() {
        this.callParent(arguments);

        this.mixins.field.initField.call(this);
        this._initCombobox();

    },
    _initCombobox: function(){
        if (this.down('rallycombobox')){
            this.down('rallycombobox').destroy();
        }
        if (this.down('rallytagpicker')){
            this.down('rallytagpicker').destroy();
        }
        var me = this;

        if (this.fieldName === 'Tags'){
            this.add({
                xtype: 'rallytagpicker'
            });
            return;
        } else {
            this._addMultiValueComboBox();
        }
    },
    _addMultiValueComboBox: function(){
        var me = this;

        this.add([{
            xtype: 'rallycombobox',
            name: 'valField',
            plugins: ['rallyfieldvalidationui'],
            multiSelect: true,
            emptyText: this.emptyText,
            displayField: 'name',
            valueField: 'value',
            width: this.width,
            editable: false,
            submitValue: false,
            storeType: 'Ext.data.Store',
            storeConfig: {
                remoteFilter: false,
                fields: ['name', 'value'],
                data: []
            },
            listeners: {
                'change': function(cb,new_value, old_value){
                    me.currentValue = new_value;
                }
            }
        }]);

        if (this.modelName && this.fieldName){
            this._loadValues();
        }
    },
    _loadValues: function() {
        console.log('_loadValues', this.modelName, this.fieldName);
        Rally.technicalservices.WsapiToolbox.fetchAllowedValues(this.modelName,this.fieldName).then({
            scope: this,
            success: function(value_names) {

                var values = Ext.Array.map(value_names,function(value_name){
                    return { 'name': value_name, 'value': value_name }
                });

                var combobox = this.down('rallycombobox');
                combobox.getStore().loadData(values);

                var current_values = this.getValue();
                console.log('current values:', current_values);

                if ( current_values && !Ext.isArray(current_values) ) {
                    current_values = current_values.split(',');
                }
                combobox.setValue(current_values);
                this.fireEvent('ready',this);

            },
            failure: function(msg) {
                Ext.Msg.alert('Problem Retrieving States', msg);
            }
        });
    },

    getSubmitData: function() {
        var data = {};
        if (this.down('rallytagpicker')){
            var vals = [];
            _.each(this.down('rallytagpicker').getValue(), function(tag){
                vals.push(tag.get('Name'));
            });
            data[this.name] = vals;
        } else {
            data[this.name] = this.currentValue;
        }

        return data;
    }
});
