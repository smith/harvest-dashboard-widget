/*

Copyright (C) 2006-2007, Iridesco, LLC.  All rights reserved.
Code and design: D. Wen

No portion of this code may be duplicated or reproduced in another widget
without written permission from Iridesco, LLC.: info@iridesco.com

1.0 - 11/1/06 - Initial release!
1.5 - 9/26/07 - A major clean up!
1.6 - 11/6/07 - Getting it to work in Leopard!
1.6.1 - 11/9/07 - Fix issue with http/https redirects

Hey you competitor, stop stealing our design and code!  We know who you are.

*/

var MAX_TOP_DISPLAY_LENGTH = 25;  // number of characters to display before trimming
var MAX_DRAWER_DISPLAY_LENGTH = 28;  // number of characters to display before trimming


var dashActive = true;
var timerRunning = false;
var timerShown = true;
var currentDay;
var secondAttempt = false;

var drawerExpandedWidth = 93;
var drawerExpandedHeight = 400;
var currentHeight;

var bottomDrawer;
var playPauseButton;
var plusMinusButton;
var urlInput;
var emailInput;
var passwordInput;
var currentEntryId;
var timerID;

var projectDisplay;
var taskDisplay;
var timeDisplay;

var gBackShown = false;
var formExpanded = false;
var projectListLoaded = false

var selectedTimer;

var clickDelay = new Array();  // used for buffering time to react to a double-click

var projectInputText;
var taskInputText;

var performEdit = false;

var data = '';
var row_data = ''

// to store all attributes for an entry row
var    all_entries_array = new Array();

//var timerRunning = true;
var startTime = new Date().getTime();

var networkStatusPosition = 1;
var networkStatusTimer;

//network status should be "stopped", "animating", or "error";
var networkStatus = "stopped";
var plusEnabled = true;

var version = 28;


function initialize (event)
{
    if (window.widget) {
      getVersionNumber();
      widget.onshow = handleWidgetShown;
      widget.onhide = handleWidgetHidden;

        window.collapsedWidth = 276;
        window.collapsedHeight = 180;
        window.expandedFormWidth = 280;
        window.expandedFormHeight = 244;
        window.backsideWidth = 278;
        window.backsideHeight = 221;
        with (window) {
            resizeTo(collapsedWidth, collapsedHeight);
            currentHeight = collapsedHeight;
        }
    }

    window.form_drawer = document.getElementById('formDrawer').style;
    window.view_port = document.getElementById('viewPort').style;

    // create all widget buttons
    hDoneButton = new AppleGlassButton (document.getElementById ('backDone'), 'Done', handleDoneButtonClick);
    hCancelButton = new AppleGlassButton (document.getElementById ('backCancel'), 'Cancel', handleCancelButtonClick);
    flipperIcon = new Fader(document.getElementById('flip'), null, 1/3*1000);
    projectDisplay = new Fader(document.getElementById('projectDisplay'), null, 1/3*1000);
    taskDisplay = new Fader(document.getElementById('taskDisplay'), null, 1/3*1000);
    timeDisplay = new Fader(document.getElementById('timeDisplay'), null, 1/3*1000);
    playPauseButton = document.getElementById('playPauseButton');
    plusMinusButton = document.getElementById('plusMinusButton');

    projectInputText = document.getElementById("projectInputText");
    taskInputText = document.getElementById("taskInputText");

    // simulate widget shown for local dev

    if (window.widget) {
        handleWidgetShown();
    } else {
        handleWidgetShown();
        perform_request("daily", handleDailyResult, "");
    }
}

function handleWidgetShown() {
    dashActive = true;
    perform_request("daily", handleDailyResult, "");
}

function handleWidgetHidden() {

    dashActive = false;
  stopTimer();
    timerShown = false;
}

function goToHarvest() {
    var p = Preference.get('url');
    if (p.slice(0, 7) == "http://") p = p.slice(7, p.length);
    if (p.slice(0, 8) == "https://") p = p.slice(8, p.length);
  if (Preference.get('protocol') != null)
    widget.openURL(Preference.get('protocol')+p+'.harvestapp.com/timesheets');
}

function goToHarvestPlans() {
    var p = Preference.get('url');
    if (p.slice(0, 7) == "http://") p = p.slice(7, p.length);
    if (p.slice(0, 8) == "https://") p = p.slice(8, p.length);
  widget.openURL("http://"+p+'.harvestapp.com/company/edit_plan');
}

/*----------------------------------------------------------------------------------
    Functions for button actions
----------------------------------------------------------------------------------*/
function handlePlusMinusClick(event, buttonID)
{
    if (plusEnabled) {
        if (formExpanded) {
            collapseForm();
        } else {
              expandForm(true);
        }
  }
}

function handlePlayPauseClick(event, buttonID)
{
  if (selectedTimer){
        perform_request("daily/timer/" + selectedTimer.id, handleTimerToggleResult,"");
    }
    else
      expandForm();
}

function handleSaveTimeClick(event, buttonID)
{

  // create the JSON object for save or update
  var project_id = document.getElementById('projectInput').value;
  var task_id = document.getElementById('taskInput').value;
  var notes = document.getElementById('notesInput').value;
  var hours = convert_hhmm_to_decimal(document.getElementById('hoursInput').value);

  var submitObj = {"notes": notes, "hours": hours, "project_id": project_id, "task_id": task_id, "spent_at": data.for_day};

    // if this is to update a row, get the row id from preferences
    if (performEdit) {
      action = "daily/update/" + currentEntryId;
        perform_request(action, handleDailyEditResult, submitObj);
        performEdit = false;
    }    else {
        perform_request("daily/add", handleDailyAddResult, submitObj);
    }

    // clean up functions
  collapseForm();

    // clear out notes and time fields
    document.getElementById('notesInput').value = '';
  document.getElementById('hoursInput').value = '';

  // start timer if no time was entered
    document.getElementById('plusMinusButton').style.backgroundImage = 'url(Images/button-plus.png)';
}

function handleCancelTimeClick(event, buttonID)
{
    // collapse the form
    collapseForm();

    // set edit flag to false
    performEdit = false;
}

function handleDoneButtonClick(event, buttonID)
{
    hideBack(true);
}

function handleCancelButtonClick(event, buttonID)
{
  hideBack(false);
}

function handleProjectInputChange(event, buttonID)
{
    // update display to reflect selection
    var selectObj = document.getElementById('projectInput');
    var projectInputText = document.getElementById("projectInputText");
    projectInputText.innerHTML = selectObj.options[selectObj.selectedIndex].text;
    Preference.set("projectInputText", selectObj.options[selectObj.selectedIndex].text);
     Preference.set("projectInput",selectObj.value);

    // load new task list
  loadTasksList(selectObj.value);
}

function handleTaskInputChange(event, buttonID)
{
    // update display to reflect selection
    var selectObj = document.getElementById('taskInput');
    taskInputText.innerHTML = htmlEscape(selectObj.options[selectObj.selectedIndex].text);
    Preference.set("taskInputText", selectObj.options[selectObj.selectedIndex].text);
     Preference.set("taskInput",selectObj.value);
}

// -- FLIPPER FADERS
function handleMouseMove(event)
{
    if (flipperIcon) flipperIcon.fadeIn();
}
function handleMouseOut(event)
{
    if (flipperIcon) flipperIcon.fadeOut();
}
function enterFlip(event) {
  document.getElementById('fliprollie').style.display = 'block';
}
function exitFlip(event) {
  document.getElementById('fliprollie').style.display = 'none';
}

function showBack() {
    var front = document.getElementById("front");
    var back = document.getElementById("back");

    if (window.widget) {
        // set values from preferences
        prefURL.value = '';
        prefEmail.value = '';
        prefPassword.value = '';
        if (Preference.get('url')) prefURL.value = Preference.get('url');
        if (Preference.get('email')) prefEmail.value = Preference.get('email');
        if (Preference.get('password')) prefPassword.value = Preference.get('password');

        with (window) {
            if (currentHeight < expandedFormHeight)
              resizeTo(window.expandedFormWidth, window.expandedFormHeight);
      }
        widget.prepareForTransition("ToBack");
    }

    front.style.display="none";
    back.style.display="block";

    if (window.widget) {
        setTimeout ('widget.performTransition();', 0);
    }

    gBackShown = true;
}

function hideBack(validateInput) {
    if (validateInput) {
        // set up user input
      var url = document.getElementById('prefURL').value;
      var email = document.getElementById('prefEmail').value;
      var password = document.getElementById('prefPassword').value;

        document.getElementById('backAjaxMsg').innerHTML = "Verifying...";

      // save to preferences if everything is good
      Preference.set('url', url);
      Preference.set('email', email);
      Preference.set('password', password);

        // validate the information via connection
        secondAttempt = false;
        perform_request("daily", handleBackInputValid, "");
  } else {
         visuallyHideBack();
  }
}

function visuallyHideBack() {
    // everything below is for the visual
    var front = document.getElementById("front");
    var back = document.getElementById("back");

    if (window.widget) {
        // window.resizeTo(window.collapsedWidth, window.collapsedHeight);
        widget.prepareForTransition("ToFront");
    }

    front.style.display="block";
    back.style.display="none";

    // fade out flipper & clean up rollie
    flipperIcon.fadeOut();
    exitFlip();

    if (window.widget) {
        setTimeout ('widget.performTransition();', 0);
    }

    gBackShown = false;
}

/*----------------------------------------------------------------------------------
    Preference Util
----------------------------------------------------------------------------------*/
var Preference = new Object();
Preference.instancePrefs = new Array();

Preference.get = function (key) {
    if (window.widget) {
        var str = widget.preferenceForKey(_createkey(key));
        return str;
    }
}

Preference.set = function (key,value) {
    if (window.widget) {
        var instanceKey = _createkey(key);
        widget.setPreferenceForKey(value, instanceKey);
        widget.setPreferenceForKey(value, key);
        Preference.instancePrefs[instanceKey] = true;
    }
}

Preference.removeInstancePreferences = function () {
    if (window.widget) {
        for (key in Preference.instancePrefs) {
            widget.setPreferenceForKey(null, key);
        }
    }
}

function _createkey(key) {
    // return key;
    // Use the next line for instance preferences
  return widget.identifier + '-' + key;
}


/*----------------------------------------------------------------------------------
    Toggle drawer functions
----------------------------------------------------------------------------------*/

// loads data
// create text rows for the data
// create background rows for the data
function setupToggleDrawer() {

    // fill in the backgorund
    container = document.getElementById('toggleDrawerContainer');
    var tableContainer = document.getElementById('tbody');

    // update today's date
    newDay = data.for_day.substr(0, 11);

    document.getElementById('dateToday').innerHTML = newDay;

    currentDay = newDay;
    removeAllChildren(container);
    removeAllChildren(tableContainer);

    if (data.day_entries != null) {
        if (data.day_entries.length > 0) {
              $A(data.day_entries).each(function(e){
                        var row = createRow(e);
                        tableContainer.appendChild (row);
                });
              new_height = window.collapsedHeight + (28 * data.day_entries.length);

            createBackgroundRows(data.day_entries.length);
        } else {
            // create default rows
                var row = document.createElement('tr');
            row.setAttribute ("class", "projectRow");

                var td = document.createElement ('td');
                td.setAttribute ("class", "projecttask");
                td.setAttribute ("colspan", "2");

                td.appendChild (document.createTextNode("No entries today."));
                row.appendChild (td);

              tableContainer.appendChild(row);
              new_height = 210;//window.collapsedWidth + (28);

              createBackgroundRows(1);

              // reset display
              document.getElementById('projectDisplay').innerHTML = "Client - Project";
              document.getElementById('taskDisplay').innerHTML = "Task";
              document.getElementById('timeDisplay').innerHTML = "0.00";
        }
  } else {
      // create default rows
        var row = document.createElement('tr');
    row.setAttribute ("class", "projectRow");

        var td = document.createElement ('td');
        td.setAttribute ("class", "projecttask");
        td.setAttribute ("colspan", "2");

        td.appendChild (document.createTextNode("No entries today."));
        row.appendChild (td);

      tableContainer.appendChild(row);
      new_height = 210;//window.collapsedWidth + (28);

      createBackgroundRows(1);

      // reset display
      document.getElementById('projectDisplay').innerHTML = "Client - Project";
      document.getElementById('taskDisplay').innerHTML = "Task";
      document.getElementById('timeDisplay').innerHTML = "0.00";
  }

  // resize the window
  if (window.widget) {
        with (window) {
            resizeTo(collapsedWidth, new_height);
            currentHeight = new_height;
        }
  }

  // with all rows created, display edit buttons
    showPencils();

    // set the right height for the new version display image
    document.getElementById("newVersionDiv").style.top = (new_height-101)+"px";

    updateDaySum();
}

function createBackgroundRows(totalRows) {
    // set up first row
    var div = document.createElement ('div');
    div.setAttribute  ("class", "drawerTop");
  container.appendChild(div);

    // set up middle rows
        for (var i = 0; i < totalRows - 1; ++i)
        {
            var div = document.createElement ('div');
            div.setAttribute  ("class", "drawerRow");
            container.appendChild (div);
        }

    // set up last row
    var div = document.createElement ('div');
    div.setAttribute  ("class", "drawerBottom");
    // add plus-minus button and total
    plusMinusBtnDiv = document.createElement('div');
    plusMinusBtnDiv.setAttribute("id", "plusMinusButton");
    plusMinusBtnDiv.setAttribute("onclick", "handlePlusMinusClick();");
    networkStatusDiv = document.createElement('div');
    networkStatusDiv.setAttribute("id", "networkStatus");
    networkStatusErrorText = document.createElement('div');
    networkStatusErrorText.setAttribute("id", "networkStatusErrorText");
    networkStatusErrorText.innerHTML = "Authentication error";
    totalDiv = document.createElement('div');
    totalDiv.setAttribute("id", "totalToday");
    div.appendChild(plusMinusBtnDiv);
    div.appendChild(totalDiv);
    div.appendChild(networkStatusDiv);
    div.appendChild(networkStatusErrorText);
  container.appendChild(div);

    toggleNetworkStatusRollie();
}

//sets the current state of the networkStatusRollie
function toggleNetworkStatusRollie(){

    switch (networkStatus){
        case 'animating':
            startNetworkActivityRollie();
            break;
        case 'error':
            showNetworkError();
            break;
        default:
            hideNetworkActivityRollie();
    }
}

//starts the animated network status rollie
function startNetworkActivityRollie(){
    document.getElementById("plusMinusButton").style.opacity = .5;
    plusEnabled = false;
    networkStatus = 'animating';

    window.clearInterval(networkStatusTimer);
    if (document.getElementById("networkStatus")) {
        document.getElementById("networkStatusErrorText").style.display = "none";
        document.getElementById("networkStatus").style.display = "block";
    }
    networkStatusTimer = window.setInterval(animateNetworkActivity, 90);
}

//handles the network rollie animation
function animateNetworkActivity(){

    networkStatusPosition++;
    if (networkStatusPosition > 12) networkStatusPosition = 1;

    if (document.getElementById("networkStatus")) document.getElementById("networkStatus").style.background = 'url(Images2/'+networkStatusPosition+'.png) no-repeat 0 0';

}

//Throws up the exclamation point rollie when there's an error
function showNetworkError(){
    networkStatus = 'error';
    document.getElementById("plusMinusButton").style.opacity = .25;
    window.clearInterval(networkStatusTimer);
    hidePencils();
    if (document.getElementById("networkStatus")) {
        document.getElementById("networkStatus").style.display = "block";
        document.getElementById("networkStatusErrorText").style.display = "block";
        document.getElementById("newVersionDiv").style.display="none";
        document.getElementById("networkStatus").style.background = 'url(Images2/rollie_alert_off.png) no-repeat 0 0';
    }
}

//Hides the network status rollie - happens when the most recent communication with Harvest made it through
function hideNetworkActivityRollie(){
    document.getElementById("plusMinusButton").style.opacity = 1;
    plusEnabled = true;
    networkStatus = 'stopped';
    window.clearInterval(networkStatusTimer);

    if (document.getElementById("networkStatus")) {
        document.getElementById("networkStatus").style.display = "none";
        document.getElementById("networkStatusErrorText").style.display = "none";
    }
}

function pencilOver(){
    if (this.style.opacity == .5) {
        return 0;
    }

    this.style.background = "url(Images2/rollie_pencil_down.png) no-repeat top left";

    row_node = document.getElementById(this.id.substr(12, this.id.length));
    project_task = document.getElementById("projecttask_" + this.id.substr(12, this.id.length)).innerHTML;
    row_info = getEntryDetails(row_node.id);
    if (row_info.notes.length > 0)
      document.getElementById("projecttask_" + this.id.substr(12, this.id.length)).innerHTML = trimDrawerDisplay("<em> " + row_info.notes +"</em>");
}

function pencilOut(){
    this.style.background = "url(Images2/rollie_pencil.png) no-repeat top left";

    row_node = document.getElementById(this.id.substr(12, this.id.length));
    row_info = getEntryDetails(row_node.id);
    projecttask = trimDrawerDisplay(row_info.projectName + " (" + row_info.taskName + ")");
  document.getElementById("projecttask_" + this.id.substr(12, this.id.length)).innerHTML = projecttask;
}

function pencilDown(){
    if (this.style.opacity == .5) return 0;
    this.style.background = "url(Images2/rollie_pencil_over.png) no-repeat top left";
}

function pencilUp(){
    this.style.background = "url(Images2/rollie_pencil.png) no-repeat top left";
}

function hidePencils(){
    var children = document.getElementsByClassName('pencilImage');
    children.each(
        function(e) {
            e.style.opacity = .5;
        }
    );
    // if there's a previously selected timer, visually unselect it and update the hours

}

function showPencils(){
    DEBUG("*** SHOWING PENCILS *****")
    var children = document.getElementsByClassName('pencilImage');
    children.each(
        function(e) {
            e.style.opacity = 1;
        }
    );

    row_children = document.getElementsByClassName('projectRow');
    row_children.each(
        function(e) {
            e.style.background = 'transparent';
        }
    );

    // if there's a previously selected timer, visually unselect it and update the hours
  if (selectedTimer && timerRunning) {
      DEBUG(" setting active state");
      document.getElementById('pencilImage_'+selectedTimer.id).style.opacity = .5;
    document.getElementById(selectedTimer.id).style.backgroundImage = "url(Images/selected-row-bg.png)";
  }
}
// function to handle row clicks
function clickonrow (event, row)
{
    // set a micro delay so it's not executed immediately
//    clickDelay.push(setTimeout('perform_request("daily/timer/" + '+ row.id + ', handleTimerToggleResult,"")', 250));
    perform_request("daily/timer/" + row.id, handleTimerToggleResult,"");
}

// when double-clicked, bring up edit dialogue
function doubleclickonrow (event, row)
{
//    clearAllClickDelays();

    expandForm();

    // set the form accordingly
    var projectInput = document.getElementById('projectInput');
    var taskInput = document.getElementById('taskInput');
  var notesInput = document.getElementById('notesInput');
  var hours = document.getElementById('hoursInput');

    // display the correct project, task, notes, and hours
  row_info = getEntryDetails(row.id)

    projectInput.value = row_info.projectId;
    projectInputText.innerHTML = row_info.projectName;

    loadTasksList(row_info.projectId);
    taskInput.value = row_info.taskId;
    taskInputText.innerHTML = row_info.taskName;

    notesInput.value = (row.notes != "null") ? row_info.notes : "";
    hoursInput.value = parseFloat(document.getElementById('hours_' + row.id).innerHTML);

    performEdit = true;
    currentEntryId = row.id;
}

// starts or stops a timer and optionally stops/updates the previous timer
// called when the server responds with success
function toggleTimer (row_id)
{
    DEBUG("********* Calling ToggleTimer ***********");
    // if there's a previously selected timer, visually unselect it and update the hours
  if (selectedTimer) {
      DEBUG("****** UNSELECTING ROW: "+ selectedTimer.id + " " + selectedTimer.style.background);
      selectedTimer.style.background = "transparent";
    DEBUG("****** UNSELECTING ROW: "+ selectedTimer.id + " " + selectedTimer.style.background);

         document.getElementById('pencilImage_'+selectedTimer.id).style.opacity = 1;
      selectedTimer.style.background = "transparent";
    selectedTimer = '';
    DEBUG("unselected confirm: "+ selectedTimer.id);
  }

  // set the new selection as the current timer
  if ((row_data.timer_started_at) || (row_data.day_entry)) {
      row = document.getElementById(row_id);
      DEBUG('setting selectedTimer '+row.id)
      selectedTimer = row;
      row.style.backgroundImage = "url(Images/selected-row-bg.png)";
      // update main display
      displayUpdate(row, (row_data.timer_started_at) ? row_data.hours : row_data.day_entry.hours);

      document.getElementById('pencilImage_'+selectedTimer.id).style.opacity = .5;

    } else {

        stopTimer();
    }

  showPencils();
}

function clickedPencil(e, row){
    e.stopPropagation();
    e.preventDefault();
    if (plusEnabled) {
        if (selectedTimer) {

            if ((row.id != ("projecttaskpencil_"+selectedTimer.id)) || timerRunning== false) {
                // substring 18 to take out the "projecttaskpencil_" prepended to the actual id
                doubleclickonrow (e, document.getElementById(row.id.substring(18)));
            }
        } else {
            if (timerRunning == false) {
                doubleclickonrow (e, document.getElementById(row.id.substring(18)));
            }
        }
    }
}

function createRow (object)
{
    DEBUG('creating row: '+object.id);
    var row = document.createElement('tr');

    // create a proper detailed has for task attributes
    entry_info = $H({ id: object.id, clientName: object.client, projectId: object.project_id, projectName: object.project, taskId: object.task_id, taskName: object.task, notes: object.notes });

    // add to big array
    all_entries_array.push(entry_info);

    row.setAttribute ("class", "projectRow");
    row.setAttribute ("id", object.id);
    row.setAttribute ("onclick", "clickonrow(event, this);");

    // when you do set up drawer, update the last selected row with the latest time
    // and then add the timer on the new row.

    // if timer is already running, indicate as such
    if (object.timer_started_at) {
        if (selectedTimer) {
            selectedTimer.style.background = "transparent";
        }

        DEBUG("setting selectedTimer to: "+ object.id);
        row.style.backgroundImage = "url(Images/selected-row-bg.png)";
        selectedTimer = row;

        // remove this attribute so we only highlight this once upon loading
        object.timer_started_at = '';
        displayUpdate(row, object.hours);
  }

    var td = document.createElement ('td');
    td.setAttribute("class", "projecttaskpencil");
    td.setAttribute("id", "projecttaskpencil_" + object.id);
    // td.setAttribute("parentID", object.id);
    td.setAttribute("width", "20px");
    td.setAttribute("onclick", "clickedPencil(event, this);");
    var pencilImage = document.createElement("div");
    pencilImage.setAttribute("class", "pencilImage");
    pencilImage.onmouseover = pencilOver;
    pencilImage.onmouseout = pencilOut;
    pencilImage.onmousedown = pencilDown;
    pencilImage.onmouseup = pencilUp;
    pencilImage.setAttribute("id", "pencilImage_"+object.id);

    if (object.timer_started_at && timerRunning) {
        pencilImage.setAttribute("opacity", 0);

    }

    td.appendChild(pencilImage);
    row.appendChild(td);

    td = document.createElement('td');
    td.setAttribute ("class", "projecttask");
    td.setAttribute ("id", "projecttask_" + object.id);
    projecttask = trimDrawerDisplay(object.project + " (" + object.task + ")");
    td.appendChild (document.createTextNode(htmlUnescape(projecttask)));
    row.appendChild (td);

    td = document.createElement('td');
    td.setAttribute ("class", "hours");
    td.setAttribute ("id", "hours_" + object.id);
    td.appendChild (document.createTextNode(object.hours));
    row.appendChild (td);

    return row;
}

/*----------------------------------------------------------------------------------
    Functions to update main display
----------------------------------------------------------------------------------*/

// helper to retrieve entry information based on entry's id
function getEntryDetails(id) {
    // loop through all entries until we find the one we want -- inefficient but works
    for (i=0;i<all_entries_array.length;i++) {
        if (all_entries_array[i].id == id) {
            return all_entries_array[i];
        }
    }
}

// updates the main "player" with current project/task and time
function displayUpdate(row, elapsedHours) {

    row_info = getEntryDetails(row.id)
    // clientName = all_entries[row.id + "id"].clientName;
     document.getElementById('projectDisplay').innerHTML = trimTopDisplay(row_info.clientName + " - " + row_info.projectName);
     document.getElementById('taskDisplay').innerHTML = trimTopDisplay(row_info.taskName);

    // update the time
    // convert decimal to milliseconds
    elapsedTimeInMs = elapsedHours * 3600000;
    startTime = new Date().getTime() - elapsedTimeInMs;
    // start a timer only if one wasn't already running
    window.clearInterval(timerID);
    timerID = window.setInterval(runTimer, 1000);
    if (!timerRunning) {
        projectDisplay.fadeIn();
        taskDisplay.fadeIn();
        timeDisplay.fadeIn();
    }

    timerRunning = true;
  playPauseButton.style.backgroundImage = 'url(Images/button-pause.png)';
}

function stopTimer() {

    projectDisplay.fadeDim();
    taskDisplay.fadeDim();
    timeDisplay.fadeDim();

  window.clearInterval(timerID);

  timerRunning = false;

    window.pulseAnimator.stop();

    selectedTimer = '';

    playPauseButton.style.opacity = 1;

  playPauseButton.style.backgroundImage = 'url(Images/button-play.png)';

}

// takes in elapsed time in thousandth of a second
function runTimer() {
    var Now = new Date().getTime();
    elapsedTime = Now - startTime;

    var afterH= elapsedTime % 3600000;
    timeH = (elapsedTime - afterH) / 3600000;
    var afterM= afterH % 60000;
    timeM = (afterH - afterM) / 60000;
    timeS = Math.floor(afterM / 1000);
    updateTimerDisplay(elapsedTime);
}

function updateTimerDisplay (elapsedTime)
{
    var h = parseInt(timeH, 10);
    var m = parseInt(timeM, 10);
    var s = parseInt(timeS, 10);
    if (timerRunning == true) {
        if (s < 10) s = '0' + s;
        if (m < 10) m = '0' + m;
        if (h < 10) h = '0' + h;
        // document.getElementById('timeDisplay').innerHTML = "<span class='timerRunning'>" + h + ":" + m + "</span>";
        document.getElementById('timeDisplay').innerHTML = "<span class='timerRunning'>" + (elapsedTime / 3600000).toFixed(2) + "</span>";
    }

    // update the selected row's hours and update the overall day's hours
    // new_hours = convert_hhmm_to_decimal(h+":"+m);
    document.getElementById("hours_" + selectedTimer.id).innerHTML = (elapsedTime / 3600000).toFixed(2);
    if (!timerShown) {
        // fade in time display
        projectDisplay.fadeIn();
        taskDisplay.fadeIn();
        timeDisplay.fadeIn();
        timerShown = true;
    }
    updateDaySum();
    window.pulseAnimator = new AppleAnimator(1000, 50, .7, 1.3, function(animator, current, start, finish) {
        if (current > 1)
          current = 2 - current;
        playPauseButton.style.opacity = current;});
  window.pulseAnimator.start();
}

/*----------------------------------------------------------------------------------
    Math functions
----------------------------------------------------------------------------------*/

// adds sums from the day's tasks and refreshes the display at top
function updateDaySum() {
    document.getElementById('totalToday').innerHTML = 'executing..';
    var daySum = 0;
    var children = document.getElementsByClassName('hours');
    children.each(
        function(e) {
            daySum += parseFloat(e.innerHTML);
        }
    );
    document.getElementById('totalToday').innerHTML = daySum.toFixed(2);
}

function convert_hhmm_to_decimal (input_value) {
  if ((input_value != null) && (input_value.indexOf) && (input_value.indexOf(':') != -1)) {
    time = input_value.split(':');
    if (time[0] == "") {
      hours = 0;
    }  else {
      hours = parseFloat(time[0]);
    }
    minutes = parseFloat(time[1] / 60);
    input_value = (minutes + 0 + hours).toFixed(2);
  }
  return input_value;
}


/*----------------------------------------------------------------------------------
    Time entry drawer functions
----------------------------------------------------------------------------------*/

/** form expansion and collapse **/
function expandForm(forceRefresh) {
  if (window.widget) {
        with (window) {
            if (currentHeight < window.expandedFormHeight)
              resizeTo(window.expandedFormWidth, window.expandedFormHeight);
      }
  }

    if ((!projectListLoaded) || (forceRefresh)) {
        loadProjectsList();
        projectListLoaded = true;

        // clear out notes and time fields
        document.getElementById('notesInput').value = '';
      document.getElementById('hoursInput').value = '';
    }

  // turn on the form_drawer div
  window.view_port.display = 'block';

  window.animator = new AppleAnimator(300, 10, -143, 0, function(animator, current, start, finish) {window.form_drawer.top = current+'px';});
  window.animator.start();
    document.getElementById('plusMinusButton').style.backgroundImage = 'url(Images/button-minus.png)';
    formExpanded = true;
}

function loadProjectsList() {
    // load options into the project dropdown
    var currentClient = ''
    var projectInput = document.getElementById("projectInput");
    var optGroup;
    projectInput.innerHTML = '';

  $A(data.projects).sortBy(function(p){return p.client + p.name}).each(function(p){
                    // if this is a new client, create the option group for it
                    if (currentClient != p.client)  {
                        // add the last option group to the input selector if one has been created
                        if (currentClient != '')
                            projectInput.appendChild(optGroup);
                        optGroup = document.createElement("optgroup");
                        optGroup.setAttribute("label", p.client)
                        currentClient = p.client;
                    }

                    // keep adding this to the option group
                    var option = document.createElement("option");
                    option.value = p.id;
                    option.innerHTML = p.name;
                    optGroup.appendChild(option);

        });

  // tack on the final optgroup
  projectInput.appendChild(optGroup);

    // display the default
    projectInput.selectedIndex = 0;
    projectInputText.innerHTML = projectInput.options[0].text;

//    projectInputText.innerHTML = data.projects[0].name;
//    projectInput.value = data.projects[0].id;

    // load default task list
    loadTasksList(data.projects[0].id);
}

function loadTasksList(project_id) {
    if (!project_id)
      project_id = 1;

    var taskInput = document.getElementById("taskInput");
    removeAllChildren(taskInput);

    // display the default and select it
    var taskInputText = document.getElementById("taskInputText");
    taskInputText.innerHTML = '';

    // we always start with the billable group
    var billable = false;
    var currentGroup = '';

    // loop through the json object to find the desired project.  optimize later
  $A(data.projects).each(function(p){
                    // if we have a match, print out the tasks
                    if (p.id == project_id) {
                        $A(p.tasks).sortBy(function(t){return !t.billable + t.name}).each(function(t){
                                var option = document.createElement("option");
                                option.value = t.id;
                                // option.innerHTML = htmlEscape(t.name);
                                option.innerHTML = t.name;
                                // set the default
                                if (taskInputText.innerHTML == '') {
                                  taskInputText.innerHTML = htmlUnescape(t.name);
                                    Preference.set("taskInputText", t.name);
                                     Preference.set("taskInput",t.id);
                                }
                                // if the current group matches this task's billable status, add it in
                                currentTask = t.billable ? "Billable" : "Non-billable";
                                if (currentGroup != currentTask) {
                                    // wrap up the first option group
                                    if (currentGroup != '') {
                                         taskInput.appendChild(optGroup);
                                    }
                                    // start the next one
                                    optGroup = document.createElement("optgroup");
                                    optGroup.setAttribute("label", currentTask);
                                    currentGroup = currentTask;
                                }
                                optGroup.appendChild(option);
              });
                        // add last group to option group
                        taskInput.appendChild(optGroup);
                    }
        });
}

function collapseForm() {
  // turn off the form_drawer div
  window.animator = new AppleAnimator(300, 10, 0, -143, function(animator, current, start, finish) {window.form_drawer.top = current+'px';});
  window.animator.oncomplete = function() {window.view_port.display = 'none';};
  window.animator.start();

    document.getElementById('plusMinusButton').style.backgroundImage = 'url(Images/button-plus.png)';
    formExpanded = false;
}


/*** UTIL FUNCTIONS ***/
function createButton(buttonID, actionFunction)
{
    var button = document.getElementById(buttonID);
    button.setAttribute('onclick', actionFunction + '();');
}

function removeAllChildren (parent)
{
    while (parent.hasChildNodes()) {
        parent.removeChild(parent.firstChild);
    }
}

function clearAllClickDelays() {
    for (i = 0; i <= clickDelay.length; i++) {
      clearTimeout(clickDelay.pop());
    }
}

function htmlUnescape(inText) {
    return inText.replace(/&amp;/g, "&");
}

function htmlEscape(inText) {
    return inText.replace(/&/g, "&amp;");
}

function checkEnterSubmit(event) {
  if (event.keyCode == 13) {
        handleSaveTimeClick();
  }
}

// extend the Date object to return day of the year
function AddDoYMethods()
{function FDoY()
  {
    with (this)
    {
      var Y = getFullYear(), M = getMonth(), D = getDate();
    }
    return Math.round(Math.abs(Date.UTC(Y, M, D)-Date.UTC(Y, 0, 0))/86400000);
  }
  Date.prototype.getDoY = FDoY;
}

function trimTopDisplay(inputText) {
    if (inputText.length > MAX_TOP_DISPLAY_LENGTH)
      return inputText.substr(0, MAX_TOP_DISPLAY_LENGTH) + "...";
    else
      return inputText;
}

function trimDrawerDisplay(inputText) {
    if (inputText.length > MAX_DRAWER_DISPLAY_LENGTH) {
      if ((inputText.indexOf("<em>") != -1))
             return inputText.substr(0, MAX_DRAWER_DISPLAY_LENGTH+4) + "...";
      else
          return inputText.substr(0, MAX_DRAWER_DISPLAY_LENGTH) + "...";
    } else
      return inputText;
}

/*----------------------------------------------------------------------------------
  XMLhttp functions
----------------------------------------------------------------------------------*/

function perform_request(action, result_handler, post) {
    if (window.widget) {
      //strip off the http:// at the beginning of the URL if they entered it.
        var p = Preference.get('url');
        if (p.slice(0, 7) == "http://") p = p.slice(7, p.length);
        if (p.slice(0, 8) == "https://") p = p.slice(8, p.length);

      // detect HTTP vs HTTPS and save as preference
      protocol = Preference.get('protocol') || "http://";

        url = protocol + p + ".harvestapp.com/" + action;

    } else {
    url = "https://test.harvestapp.com/" + action;
    }
  request = new XMLHttpRequest();
    request.onreadystatechange = function(e) {
        if (request.readyState == 4) {

            // set the protocol based on responseHeader
            protocol = request.getResponseHeader('X-Served-From');
            if (protocol.slice(0, 7) == "http://") protocol = "http://";
            if (protocol.slice(0, 8) == "https://") protocol = "https://";
            Preference.set('protocol', protocol);

        if(request.status >= 200 && request.status < 300) {
            DEBUG(request.responseText);
                // handle misc post call functions
                // Successfully got data from Harvest server, so hide the network status rollie.
                hideNetworkActivityRollie();
                result_handler();
        } else if (request.status == 401) {
                DEBUG("401");
                showNetworkError();
                showAjaxMessage("Invalid URL or login.");
            }    else if (request.status == 400) {
                DEBUG("400");
                    showNetworkError();
                    showAjaxMessage("Widget requires <a href='javascript:goToHarvestPlans();'>account upgrade</a>.");
            } else {
          // notify about errors
                showNetworkError();
                DEBUG("undefined error!");
                showAjaxMessage(request.status+ " error.");
        }
        }
  }

startNetworkActivityRollie();
    request.open("POST", url, true);
  if (window.widget)
         request.setRequestHeader("Authorization", "Basic " + encode64(Preference.get('email') + ":" + Preference.get('password')));
  else
        request.setRequestHeader("Authorization", "Basic " + encode64("email@email.com:password"));
  request.setRequestHeader("Cache-Control", "no-cache");
  request.setRequestHeader("Accept", "application/json");
  request.setRequestHeader("Content-Type", "application/json");
  request.setRequestHeader("User-Agent", "HarvestWidget");
  request.send(post.toJSONString());
}

function handleDailyResult() {
    // use the latest data buffer and set up the toggler
    if (request.responseText.indexOf('xhtml1') == -1)
      data = eval('(' + request.responseText + ')');
  else
    data = false

  DEBUG("data: "+ data);
    // if our response didn't work (probably redirected) try other protocol
    if (data == false) {
        old_protocol = Preference.get("protocol") || "http://";

        if (secondAttempt == false) {
            perform_request("daily", handleDailyResult, "");
            secondAttempt = true;
        } else {
            showAjaxMessage("Invalid URL or login.");
        }
    } else {
        if (gBackShown = true) {
          visuallyHideBack();
        }
        setupToggleDrawer();
    }
}

function handleDailyAddResult() {
    new_entry = request.responseText.parseJSON();

    if (data.day_entries == null) {
        data.day_entries = new Array();
    }

    // need to do this silly casing because the data is different depending on previously running timer
    if (new_entry.day_entry) {
        data.day_entries.push(new_entry.day_entry);
    } else {
        data.day_entries.push(new_entry);
    }

    // DW: can't call this as this will use old data
    setupToggleDrawer();
}

function handleTimerToggleResult() {
    row_data = request.responseText.parseJSON();
    if (row_data.day_entry) {
        // selectedTimer = '';
        toggleTimer (row_data.day_entry.id);
    } else
         toggleTimer (row_data.id);
}

function handleDailyEditResult() {

    row_data = request.responseText.parseJSON();

    // update all display values
    editedRowProjectTask = document.getElementById("projecttask_" + row_data.id);
    projecttask = trimDrawerDisplay(row_data.project + " (" + row_data.task + ")");
    editedRowProjectTask.innerHTML = projecttask;

    editedRowHours = document.getElementById("hours_" + row_data.id);
    editedRowHours.innerHTML = row_data.hours;

    // remove old hash from all_entries_array
    all_entries_array.remove(row_data.id);

    // set all the row attributes to new values
    row = document.getElementById(row_data.id);

    entry_info = $H({ id: row_data.id, clientName: row_data.client, projectId: row_data.project_id, projectName: row_data.project, taskId: row_data.task_id, taskName: row_data.task, notes: row_data.notes });

    // add back to big array
    all_entries_array.push(entry_info);

    setTimeout('updateDaySum();', 500);
}

function handleBackInputValid() {
    document.getElementById('backAjaxMsg').innerHTML = "";
    handleDailyResult();
}
function showAjaxMessage(msg) {
    document.getElementById('backAjaxMsg').innerHTML = msg;
}

/*
 ************************************************************************
 * Debug code                                                                                                                   *
 ************************************************************************
 */
var debugMode = false;

// write to the debug div
function DEBUG(str) {
    if (debugMode) {
        if (window.widget) {
            alert(str);
        } else {
            var debugDiv = document.getElementById("debugDiv");
            debugDiv.appendChild(document.createTextNode(str));
            debugDiv.appendChild(document.createElement("br"));
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    }
}

// Toggle the debugMode flag, but only show the debugDiv if we're in Safari
function toggleDebug() {
    debugMode = !debugMode;
    if (debugMode == true && !window.widget) {
        document.getElementById("debugDiv").style.display = "block";
    } else {
        document.getElementById("debugDiv").style.display = "none";
    }
}


function debug(msg) {
    if (!debug.box) {
        debug.box = document.createElement("div");
        debug.box.setAttribute("style", "background-color: white; " +
                                        "color: red; " +
                                        "font-family: monospace; " +
                                        "font-size: 10; " +
                                        "border: solid black 3px; " +
                                        "position: absolute;top:0px;" +
                                        "z-index: 100;" +
                                        "padding: 10px;");

        document.body.appendChild(debug.box);
    }

    var p = document.createElement("p");
    p.appendChild(document.createTextNode(msg));
    debug.box.appendChild(p);
}

function getVersionNumber(){
    var req = new XMLHttpRequest();

    var url = "http://www.getharvest.com/downloads/dashboard-ver.txt";
    req.setRequestHeader("Cache-Control", "no-cache");
    req.open("GET", url, true);

    req.onreadystatechange=function() {
        if (req.readyState==4) {

            latestVersion = req.responseText;
            if (version < Number(latestVersion) && version!=Number(latestVersion)) {

                document.getElementById("newVersionDiv").style.display="block";
                document.getElementById("newVersionDivBack").style.display="block";

            }
        }
     }
     req.send(null)
}




