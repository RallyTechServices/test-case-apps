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
    fetchArtifacts: function(config){
        var deferred = Ext.create('Deft.Deferred');

        if (!config.limit){
           config.limit = 'Infinity';
        }
        if (!config.pageSize){
           config.pageSize = 2000;
        }

        var store = Ext.create('Rally.data.wsapi.artifact.Store',config).load({
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
    fetchModelFields: function(modelName, blacklist){
      var deferred = Ext.create('Deft.Deferred');

      Rally.data.ModelFactory.getModel({
          type: modelName,
          success: function(model) {
              var fields = model.getFields();
              if ( Ext.isEmpty(blacklist) ) {
                  deferred.resolve(fields);
                  return;
              }
              fields = Ext.Array.filter(fields, function(field){
                  return !Ext.Array.contains(blacklist,field.name);
              });
              deferred.resolve(fields);
          },
          failure: function(msg) { deferred.reject('Error loading field values: ' + msg); }
      });

      return deferred;
    },
    saveCSVToFile:function(csv,file_name,type_object){
        if (type_object === undefined){
            type_object = {type:'text/csv;charset=utf-8'};
        }
        this.saveAs(csv,file_name, type_object);
    },
    saveAs: function(textToWrite, fileName)
    {
        if (Ext.isIE9m){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for IE9 and below."});
            return;
        }

        var textFileAsBlob = null;
        try {
            textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
        }
        catch(e){
            window.BlobBuilder = window.BlobBuilder ||
                window.WebKitBlobBuilder ||
                window.MozBlobBuilder ||
                window.MSBlobBuilder;
            if (window.BlobBuilder && e.name == 'TypeError'){
                bb = new BlobBuilder();
                bb.append([textToWrite]);
                textFileAsBlob = bb.getBlob("text/plain");
            }

        }

        if (!textFileAsBlob){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for this browser."});
            return;
        }

        var fileNameToSaveAs = fileName;

        if (Ext.isIE10p){
            window.navigator.msSaveOrOpenBlob(textFileAsBlob,fileNameToSaveAs); // Now the user will have the option of clicking the Save button and the Open button.
            return;
        }

        var url = this.createObjectURL(textFileAsBlob);

        if (url){
            var downloadLink = document.createElement("a");
            if ("download" in downloadLink){
                downloadLink.download = fileNameToSaveAs;
            } else {
                //Open the file in a new tab
                downloadLink.target = "_blank";
            }

            downloadLink.innerHTML = "Download File";
            downloadLink.href = url;
            if (!Ext.isChrome){
                // Firefox requires the link to be added to the DOM
                // before it can be clicked.
                downloadLink.onclick = this.destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        } else {
            Rally.ui.notify.Notifier.showError({message: "Export is not supported "});
        }

    },
    createObjectURL: function ( file ) {
        if ( window.webkitURL ) {
            return window.webkitURL.createObjectURL( file );
        } else if ( window.URL && window.URL.createObjectURL ) {
            return window.URL.createObjectURL( file );
        } else {
            return null;
        }
    },
    destroyClickedElement: function(event)
    {
        document.body.removeChild(event.target);
    }
});
