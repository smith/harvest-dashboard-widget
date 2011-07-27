// Harvest Widget behaviors
jQuery(function ($) {
    // guards for debugging
    var widget = window.widget || {};
    widget.openURL = widget.openURL || function (url) { window.open(url); };

    // Open/close the drawer
    function toggleDrawer(event) {
        // TODO
        console.log('toggle');
    }

    // Links should use the openURL method
    $("a").live("click", function (event) {
        widget.openURL($(this).attr("href"));
        return false;
    });

    // Toggle drawer
    $("#playPauseButton, #plusMinusButton").live("click", toggleDrawer);
});
