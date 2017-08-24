
Ext.override(Rally.ui.combobox.FieldComboBox,{

    blackListFields: [],
    whiteListFields: [],
    allowedTypes: [],
    constrained: true,

    constructor: function(config) {

        this.blackListFields = config.blackListFields || [];
        this.whiteListFields = config.whiteListFields || [];
        this.allowedTypes = config.allowedTypes || [];
        this.constrained = config.constrained || false;

        this.mergeConfig(config);

        this.store = Ext.create('Ext.data.Store', {
            fields: [this.valueField, this.displayField, 'fieldDefinition'],
            data: []
        });

        return this.callParent([this.config]);
    },
    _populateStore: function() {
        if (!this.store) {
            return;
        }
        var data = _.sortBy(
            _.map(
                _.filter(this.model.getFields(), this._isNotHidden, this),
                this._convertFieldToLabelValuePair,
                this
            ),
            'name'
        );

        this.store.loadRawData(data);
        this.setDefaultValue();
        this.onReady();
    },
    _isNotHidden: function(field) {
        console.log('_isNotHidden', field,this.allowedTypes);
        var showField = false;

        if (!field.hidden && field.attributeDefinition){
            if (Ext.Array.contains(this.allowedTypes, field.attributeDefinition.AttributeType)){
                showField = true;
            }

            if (Ext.Array.contains(this.blackListFields, field.name)){
                showField = false;
            }

            if (this.constrained === true && field.attributeDefinition.Constrained !== true){
                showField = false;
            }

            if (Ext.Array.contains(this.whiteListFields, field.name)){
                showField = true;
            }
        }

        return showField;
    }
});
