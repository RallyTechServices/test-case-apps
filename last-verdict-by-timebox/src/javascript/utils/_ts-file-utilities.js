Ext.define('Rally.technicalservices.FileUtilities', {
    //singleton: true,
    logger: new Rally.technicalservices.Logger(),
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
    },
    convertDataArrayToCSVText: function(data_array, requestedFieldHash){
       
        var text = '';
        Ext.each(Object.keys(requestedFieldHash), function(key){
            text += requestedFieldHash[key] + ',';
        });
        text = text.replace(/,$/,'\n');
        
        Ext.each(data_array, function(d){
            Ext.each(Object.keys(requestedFieldHash), function(key){
                if (d[key]){
                    if (typeof d[key] === 'object'){
                        if (d[key].FormattedID) {
                            text += Ext.String.format("\"{0}\",",d[key].FormattedID ); 
                        } else if (d[key].Name) {
                            text += Ext.String.format("\"{0}\",",d[key].Name );                    
                        } else if (!isNaN(Date.parse(d[key]))){
                            text += Ext.String.format("\"{0}\",",Rally.util.DateTime.formatWithDefaultDateTime(d[key]));
                        }else {
                            text += Ext.String.format("\"{0}\",",d[key].toString());
                        }
                    } else {
                        text += Ext.String.format("\"{0}\",",d[key] );                    
                    }
                } else {
                    text += ',';
                }
            },this);
            text = text.replace(/,$/,'\n');
        },this);
        return text;
    },
     /*
     * will render using your grid renderer.  If you want it to ignore the grid renderer,
     * have the column set _csvIgnoreRender: true
     */
    getCSVFromGrid:function(app, grid, exportColumns){
        var deferred = Ext.create('Deft.Deferred');

        var store = Ext.create('Rally.data.wsapi.Store',{
            fetch: grid.getStore().config.fetch,
            filters: grid.getStore().config.filters,
            model: grid.getStore().config.model,
            enablePostGet: true,
            pageSize: 2000
        });

        var columns = exportColumns || grid.columns;
        var column_names = [];
        var headers = [];

        Ext.Array.each(columns,function(column){
            if ( column.dataIndex || column.renderer ) {
                column_names.push(column.dataIndex);
                if ( column.csvText ) {
                    headers.push(column.csvText);
                } else {
                    headers.push(column.text);
                }
            }
        });

        var csv = [];
        csv.push('"' + headers.join('","') + '"');
        var records = grid.getStore().getRange();
            for (var i = 0; i < records.length; i++) {
                var record = records[i];
                var node_values = [];

                Ext.Array.each(columns, function (column) {
                    if (column.xtype != 'rallyrowactioncolumn') {
                        if (column.dataIndex) {
                            var column_name = column.dataIndex;
                            var display_value = record.get(column_name);


                            if (!column._csvIgnoreRender && (column.renderer || column.exportRenderer)) {
                                if (column.exportRenderer) {
                                    display_value = column.exportRenderer(display_value, {}, record);
                                } else {
                                    display_value = column.renderer(display_value, {}, record);
                                }
                            }

                            node_values.push(display_value);
                        } else {
                            var display_value = null;
                            if (!column._csvIgnoreRender && (column.renderer || column.exportRenderer)) {
                                if (column.exportRenderer) {
                                    display_value = column.exportRenderer(display_value, {}, record);
                                } else {
                                    display_value = column.renderer(display_value, {}, record);
                                }
                                node_values.push(display_value);
                            }
                        }

                    }
                }, this);
                csv.push('"' + node_values.join('","') + '"');

        };
        csv = csv.join('\r\n');
        deferred.resolve(csv);

        //var record_count = grid.getStore().getTotalCount(),
        //    page_size = grid.getStore().pageSize,
        //    pages = Math.ceil(record_count/page_size),
        //    promises = [];
        //
        //for (var page = 1; page <= pages; page ++ ) {
        //    promises.push(this.loadStorePage(app, grid, store, columns, page, pages));
        //}
        //Deft.Promise.all(promises).then({
        //    success: function(csvs){
        //        var csv = [];
        //        csv.push('"' + headers.join('","') + '"');
        //        _.each(csvs, function(c){
        //            _.each(c, function(line){
        //                csv.push(line);
        //            });
        //        });
        //        csv = csv.join('\r\n');
        //        deferred.resolve(csv);
        //        app.setLoading(false);
        //    }
        //});
        return deferred.promise;

    }

});