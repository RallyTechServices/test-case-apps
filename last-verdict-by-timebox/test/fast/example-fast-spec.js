describe("Example test set", function() {
    it("should have written tests",function(){
        expect(false).toBe(false);
        expect(Ext.Date.format(new Date(),'Y')).toEqual('2017');
    });

    it('should render the app', function() {
        var app = Rally.test.Harness.launchApp("catsLastVerdictByTimebox");
        expect(app.getEl()).toBeDefined();
    });

});
