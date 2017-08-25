describe("Example test set", function() {

    it('should render the app', function() {
        var app = Rally.test.Harness.launchApp("test-status-by-attribute");
        expect(app.getEl()).toBeDefined();
    });

});
