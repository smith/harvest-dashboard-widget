/*

File: Fader.js

Abstract: JavaScript logic for one-off and transitional fades of DOM elements

Version: 1.0

© Copyright 2005 Apple Computer, Inc. All rights reserved.

IMPORTANT:  This Apple software is supplied to
you by Apple Computer, Inc. ("Apple") in
consideration of your agreement to the following
terms, and your use, installation, modification
or redistribution of this Apple software
constitutes acceptance of these terms.  If you do
not agree with these terms, please do not use,
install, modify or redistribute this Apple
software.

In consideration of your agreement to abide by
the following terms, and subject to these terms,
Apple grants you a personal, non-exclusive
license, under Apple's copyrights in this
original Apple software (the "Apple Software"),
to use, reproduce, modify and redistribute the
Apple Software, with or without modifications, in
source and/or binary forms; provided that if you
redistribute the Apple Software in its entirety
and without modifications, you must retain this
notice and the following text and disclaimers in
all such redistributions of the Apple Software.
Neither the name, trademarks, service marks or
logos of Apple Computer, Inc. may be used to
endorse or promote products derived from the
Apple Software without specific prior written
permission from Apple.  Except as expressly
stated in this notice, no other rights or
licenses, express or implied, are granted by
Apple herein, including but not limited to any
patent rights that may be infringed by your
derivative works or by other works in which the
Apple Software may be incorporated.

The Apple Software is provided by Apple on an "AS
IS" basis.  APPLE MAKES NO WARRANTIES, EXPRESS OR
IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED
WARRANTIES OF NON-INFRINGEMENT, MERCHANTABILITY
AND FITNESS FOR A PARTICULAR PURPOSE, REGARDING
THE APPLE SOFTWARE OR ITS USE AND OPERATION ALONE
OR IN COMBINATION WITH YOUR PRODUCTS.

IN NO EVENT SHALL APPLE BE LIABLE FOR ANY
SPECIAL, INDIRECT, INCIDENTAL OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) ARISING IN ANY WAY OUT OF THE USE,
REPRODUCTION, MODIFICATION AND/OR DISTRIBUTION OF
THE APPLE SOFTWARE, HOWEVER CAUSED AND WHETHER
UNDER THEORY OF CONTRACT, TORT (INCLUDING
NEGLIGENCE), STRICT LIABILITY OR OTHERWISE, EVEN
IF APPLE HAS BEEN ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.

*/


/*
 *************************************************
 * Fader object fades a single element in or out *
 *************************************************
 */

/*
 * Fader constructor.  Parameters:
 * - element: The element to fade in or out
 * - callback: A function that will be called when a fade is complete
 * - fadeTime: How long (in ms) the fade should take (see setFadeTime())
 */
function Fader (element, callback, fadeTime) {
    this.element = element;
    this.startTime = 0;
    this.timer = null;

    this.doneNotification = callback;

    // Initialize for a fade-in; these values will be reset by the fadeIn/fadeOut functions
    this.fadingIn = false;
    this.now = 0.0;
    this.from = 0.0;
    this.to = 1.0;

    this.setFadeTime(fadeTime);
}

/*
 * Prototype method declarations; call these methods as
 * nameOfFaderInstance.methodName();
 */
Fader.prototype.fadeOut = function () {
    if (this.fadingIn) {
        this.startFade(this.now, 0.0);
        this.fadingIn = false;
    }
}

Fader.prototype.fadeIn = function () {
    if (!this.fadingIn) {
        this.startFade(this.now, 1.0);
        this.fadingIn = true;
    }
}

Fader.prototype.fadeDim = function () {
    if (this.fadingIn) {
        this.startFade(this.now, 0.5);
        this.fadingIn = false;
    }
}

Fader.prototype.startFade = function (newFrom, newTo) {
    this.from = newFrom;
    this.to = newTo;

    this.startTime = (new Date).getTime() - 13; // set it back one frame

    if (this.timer != null) {
        clearInterval(this.timer);
        this.timer = null;
    }

    // Must store "this" in a local variable to call an object method in
    // a setInterval timer; this correctly binds the call to the current Fader
    // object when the timer moves out of the scope of startFade()
    //
    // Without such incapsulation, "this" would evaluate to the window object
    // when the call was finally made by the timer
    var localThis = this;
    this.timer = setInterval (function() { localThis.tick() }, 13);
}

/*
 * Setter function for fade duration (floored at 250ms)
 */
Fader.prototype.setFadeTime  = function (fadeTime) {
    this.fadeTime = fadeTime > 250 ? fadeTime : 250;
}

/*
 * tick does all the incremental work
 *
 * Every time this is hit by the timer, we calculate and apply
 * a new opacity value on our target element; eventually this will hit 1 (on
 * fade-in) or 0 (on fade-out)
 */
Fader.prototype.tick = function () {
    var T;
    var ease;
    var time = (new Date).getTime();

    // Calculate the time delta since the fade started
    T = limit_3(time-this.startTime, 0, this.fadeTime);

    // The fade is over -- clear the timer, making this the last iteration
    if (T >= this.fadeTime) {
        clearInterval (this.timer);
        this.timer = null;
        this.now = this.to;
        // invoke our callback, if one was set.
        if (this.doneNotification) {
            var localThis = this;
            setTimeout(function() { localThis.doneNotification(); }, 0);
        }
    } else {
        ease = 0.5 - (0.5 * Math.cos(Math.PI * T / this.fadeTime));
        this.now = computeNextFloat (this.from, this.to, ease);
    }

    // Set the opacity of the fading element; over repeated ticks, this.now will
    // go up (fade in) or down (fade out)
    this.element.style.opacity = this.now;
}

/*
 * support functions for tick operation
 */
function limit_3 (a, b, c) {
    return a < b ? b : (a > c ? c : a);
}

function computeNextFloat (from, to, ease) {
    return from + (to - from) * ease;
}


// End Fader object definition



/*
 **********************************************************************
 * TransitionFader object fades between 2 of x number of DOM elements *
 **********************************************************************
 */

/*
 * TransitionFader constructor.  Parameters:
 * - elements: Should be an array; use Fader object to fade a single element in/out
 * - fadeTime: How long (in ms) the fades should take
 * - inDelay: Pause (in ms) between transition fades (see setFadeDelay())
 *
 * As with Fader, all the methods should be called through an instance variable
 */
function TransitionFader (elements, fadeTime, inDelay) {
    // Create two fader objects: incoming and outgoing
    // Set prepNextFade as a callback for one of the faders, so we can cycle
    // through the elements array as a fade completes
    var localThis = this;
    this.inFader = new Fader(elements[0], function() { localThis.prepNextFade(); }, fadeTime);
    this.outFader = new Fader(null, null, fadeTime);

    // All the elements we wish to transition between
    // We do two at a time (one in / one out), but we can move through
    // an array of any size (see prepNextFade()).
    this.elements = elements;
    this.currentIndex = 0;
    this.setFadeDelay(inDelay);

    this.paused = false;
    this.interrupted = false;
}

TransitionFader.prototype.start = function () {
    this.inFader.fadeIn();
}

TransitionFader.prototype.prepNextFade = function () {
    // Before swapping the faders, make sure the element on its way out
    // is completely gone; we do this in case the in and out Faders get
    // too far out of sync (since this callback is only tied to inFader)
    if (this.outFader.element) {
        this.outFader.element.style.opacity = 0;
    }

    // Swap the faders around; the element that was just faded in
    // will now be faded out
    var temp = this.outFader;
    this.outFader = this.inFader;
    this.inFader = temp;

    // Select a new element to be faded in.
    this.currentIndex = (this.currentIndex + 1) % this.elements.length;
    this.inFader.element = this.elements[this.currentIndex];

    // Queue up the next transition using the delay property
    var localThis = this;
    window.setTimeout(function() { localThis.fade(); }, this.delay);
}

/*
 * Do the fades
 *
 * We check the paused flag in case the delayed call from prepNextFade was
 * already in place before paused was set to true: if so, we postpone the fade
 * and set the interrupted flag (see resume())
 */
TransitionFader.prototype.fade = function () {
    if (this.paused) {
        this.interrupted = true;
        return;
    }
    this.inFader.fadeIn();
    this.outFader.fadeOut();
    this.fading = true;
}

TransitionFader.prototype.getFadeTime = function () {
    return this.inFader.fadeTime;
}

TransitionFader.prototype.setFadeTime = function (newFadeTime) {
    this.inFader.setFadeTime(newFadeTime);
    this.outFader.setFadeTime(newFadeTime);
}

/*
 * Setter for the delay between fades (floored at 500ms)
 */
TransitionFader.prototype.setFadeDelay = function (inDelay) {
    this.delay = inDelay > 500 ? inDelay : 500;
}

/*
 *    Set the paused flag, so the transition timer stops the next time it is hit
 */
TransitionFader.prototype.pause = function () {
    this.paused = true;
}

/*
 * If we are in the middle of a fade, setting paused to false will allow
 * the timers to continue as usual; iff a fade was postponed, we need to
 * explicitly kick things off again
 */
TransitionFader.prototype.resume = function () {
    this.paused = false;
    if (this.interrupted) {
        this.interrupted = false;
        this.fade();
    }
}




