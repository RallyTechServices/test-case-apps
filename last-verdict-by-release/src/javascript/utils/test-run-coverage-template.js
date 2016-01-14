Ext.define('Rally.technicalservices.ProgressBarTemplate', {
    requires: [],
    extend: 'Ext.XTemplate',

    /**
     * @cfg {String}
     * define a width if necessary to fit where it's being used
     */
    width: '75%',
    /**
     * @cfg {String}
     * define a height if necessary to fit where it's being used
     */
    height: '20px',
    /**
     * @cfg {String}
     * sometimes it's necessary to name the variable used as the percent done replacement in the template,
     * like in a grid when a record is used to render the template. The record's field name might be 'PercentDoneByStoryCount', not 'percentDone'
     */
    percentDoneName: 'percentDone',

    progressCountName: 'casesRun',
    totalCountName: 'totalCases',

    /**
     * @cfg {Function}
     * A function that should return true to show a triangle in the top right to denote something is missing.
     * Defaults to:
     *      function(){ return false; }
     */
    showDangerNotificationFn: function() {
        return false;
    },

    /**
     * @cfg {Function} (required)
     * A function that returns the color for the percent done bar in hex
     */
    calculateColorFn: function(values) {
        if (this.calculatePercent(values) > 50){
            return '#8DC63F'
        } else {
            return '#FAD200';
        }
    },
    /**
     * @cfg {Boolean} (optional)
     * A boolean that indicates whether the progress bar is clickable
     */
    isClickable: false,

    /**
     * @cfg {Boolean}
     * If the percent done is 0%, do not show the bar at all
     */
    showOnlyIfInProgress: false,

    /**
     * @cfg {Function}
     * A function that returns the text to show in the progress bar.
     * Defaults to a function that returns the percentage complete.
     */
    generateLabelTextFn: function (recordData) {
        return Ext.String.format('{0} of {1} Test Cases Run (<b>{2}%</b>)', recordData[this.progressCountName], recordData[this.totalCountName], this.calculatePercent(recordData));
    },

    config: {
        shouldShowPercentDone: function(recordData) {

            var value = recordData[this.totalCountName];
            if (_.isString(value)) {
                value = +value;
            }
            if(!Ext.isNumber(value)){
                return false;
            }
            return true;
        },
        getContainerClass: function(recordData) {
            return '';
        },
        getClickableClass: function(){
            return this.isClickable ? 'clickable' : '';
        },
        getDimensionStyle: function(){
            return 'width: ' + this.width + '; height: ' + this.height + '; line-height: ' + this.height + ';display: inline-block';
        },
        calculateWidth: function (recordData) {
            var percentDone = this.calculatePercent(recordData);
            return percentDone > 100 ? '100%' : percentDone + '%';
        },
        calculatePercent: function (recordData) {

            if (recordData[this.totalCountName] && recordData[this.totalCountName] > 0){
                var percentDone = (recordData[this.progressCountName] || 0) / recordData[this.totalCountName];
                return Math.round(percentDone * 100);
            }
            return 0;

        }
    },

    constructor: function(config) {
        var templateConfig = config && config.template || [
                '<tpl if="this.shouldShowPercentDone(values)">',
                '<div class="progress-bar-container field-{[this.percentDoneName]} {[this.getClickableClass()]} {[this.getContainerClass(values)]}" style="{[this.getDimensionStyle()]}">',
                '<div class="rly-progress-bar" style="background-color: {[this.calculateColorFn(values)]}; width: {[this.calculateWidth(values)]}; "></div>',
                '<tpl if="this.showDangerNotificationFn(values)">',
                '<div class="progress-bar-danger-notification"></div>',
                '</tpl>',
                '<div class="progress-bar-label">',
                '{[this.generateLabelTextFn(values)]}',
                '</div>',
                '</div>',
                '<tpl elseif="{message}">',
                '<div>{message}</div>',
                '</tpl>'

            ];

        templateConfig.push(this.config);
        templateConfig.push(config);

        return this.callParent(templateConfig);
    }
});