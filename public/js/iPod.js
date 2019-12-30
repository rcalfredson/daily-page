(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

$(document).ready(function () {
  var v,
      up = 0,
      down = 0,
      i = 0,
      menu = 0;

  var incr = function incr() {
    i++; //code for scroll

    var current = $(".select");

    if ($(current).is(':last-child') == false) {
      $(current).removeClass('select');
      var next = $(current).next();
      $(next).addClass('select');
    }

    menu++; //count for current menu item

    if ($(".on ul a").length < menu + 1) {
      menu = $(".on ul a").length - 1;
    }

    if (menu > 5) {
      var rem = menu - 5;
      $(".on ul a:nth-child(" + rem + ")").hide();
    } //end if
    //end scroll

  };

  var decr = function decr() {
    i--; //start scroll

    menu--; //count for current menu item

    if (menu < 0) {
      menu = 0;
    }

    $(".on ul a:nth-child(" + menu + ")").show(); //this shows the menu which comes before this one, if it is hidden
    //alert("unhide");

    var current = $(".select");

    if ($(current).is(':first-child') == false) {
      //alert("last");
      $(current).removeClass('select');
      var prev = $(current).prev();
      $(prev).addClass('select');
    }

    if (menu > 5) {
      var rem = menu - 5; //alert(rem);

      $(".on ul a:nth-child(" + rem + ")").hide();
    } //end if
    //end scroll

  };

  $(".dial").knob({
    min: 0,
    max: 20,
    stopper: false,
    change: function change() {
      if (v > this.cv) {
        if (up) {
          decr();
          up = 0;
        } else {
          up = 1;
          down = 0;
        }
      } else {
        if (v < this.cv) {
          if (down) {
            incr();
            down = 0;
          } else {
            down = 1;
            up = 0;
          }
        }
      }

      v = this.cv;
    },
    'release': function release(v) {
      /*make something*/
      //alert(v);
    }
  });
});
},{}]},{},[1]);
