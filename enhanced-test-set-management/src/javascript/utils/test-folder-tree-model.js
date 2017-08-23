Ext.define('TestFolderTreeModel',{
  extend: 'Ext.data.Model',
  fields: [
      { name: 'FormattedID', type: 'String' },
      { name: 'Name', type:'String' },
      { name: 'Project', type:'auto' },
      { name: '_ref', type:'String' },
      { name: '_type', type:'String' },
      { name: 'Type', type:'String' }
  ]
});
