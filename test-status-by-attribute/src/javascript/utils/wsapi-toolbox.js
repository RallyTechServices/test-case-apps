Ext.define('Rally.technicalservices.WsapiToolbox',{
    singleton: true,
    fetchWsapiCount: function(model, query_filters){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: model,
            fetch: ['ObjectID'],
            filters: query_filters,
            limit: 1,
            pageSize: 1
        }).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(operation.resultSet.totalRecords);
                } else {
                    deferred.reject(Ext.String.format("Error getting {0} count for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    },

    fetchWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');

        if (!config.limit){
           config.limit = 'Infinity';
        }
        if (!config.pageSize){
           config.pageSize = 2000;
        }

        var store = Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(records);
                } else {
                    deferred.reject(Ext.String.format("Error getting {0} for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    },
    fetchReleases: function(timebox){

        var deferred = Ext.create('Deft.Deferred'),
            rec = timebox.getRecord(),
            me = this;

        if (rec == null) {
            deferred.resolve([]);
        }

        Ext.create('Rally.data.wsapi.Store',{
            model: 'Release',
            fetch: ['ObjectID'],
            filters: [{
                property: 'Name',
                value: rec.get('Name')
            },{
                property: 'ReleaseStartDate',
                value: rec.get('ReleaseStartDate')
            },{
                property: 'ReleaseDate',
                value: rec.get('ReleaseDate')
            }],
            limit: Infinity
        }).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(records);
                }   else {
                    deferred.reject("Error loading Releases: " + operation.error.errors.join(','));
                }
            }
        });
        return deferred;
    },

    fetchAllowedValues: function(model,field_name) {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: model,
            success: function(model) {
                model.getField(field_name).getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        var values = Ext.Array.map(records, function(record) {
                            return record.get('StringValue');
                        });
                        deferred.resolve(values);
                    }
                });
            },
            failure: function(msg) { deferred.reject('Error loading field values: ' + msg); }
        });

        return deferred;

    },
    fetchModelFields: function(modelName){
      var deferred = Ext.create('Deft.Deferred');

      Rally.data.ModelFactory.getModel({
          type: modelName,
          success: function(model) {
              deferred.resolve(model.getFields());
          },
          failure: function(msg) { deferred.reject('Error loading field values: ' + msg); }
      });

      return deferred;
    }
});
