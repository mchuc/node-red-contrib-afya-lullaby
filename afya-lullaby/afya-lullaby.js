/**
 * Lullaby Marcin Chuć
 * e-mail: marcin ...change it to at... afya.pl
 * (C) 2019
 */

module.exports = function(RED) {

  /**
   main function
  */
  function AFYALullaby(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.on('input', function(msg) {
      /*
      Math.seed = Date.now();
      if (node.variableName === undefined) {
        node.variableName = "AFYALullaby_" + Math.random().toString(36).substr(2, 5) + Date.now().toString().substr(-3);

      }
      var myLullaby = node.context().flow.get(node.variableName) || {};

      */
      // kill message
      if ('payload' in msg) {
        if (String(msg['payload']).toLowerCase() == "kill" || String(msg['payload']).toLowerCase() == "stop") {
          if ('timeObject' in node) {
            deleteInterval(node);
            this.status({
              fill: "red",
              shape: "dot",
              text: "state: killed...  <" + timeConvert(Date.now()) + ">"
            });

          } else {
            this.status({
              fill: "yellow",
              shape: "dot",
              text: "state: tried to kill...but the node stopped  <" + timeConvert(Date.now()) + ">"
            });
          }
          return;
        }
      }

      // exit, if started angin : i have timeObject - also Loop exists
      if (node.timeObject !== undefined) {
        return;
      }
      if (myLullaby === undefined) {
        var myLullaby = {};
      }

      // this variable changes the state - true/false to choose box or ring as node state
      if (myLullaby.boxOrRing === undefined) {
        myLullaby.boxOrRing = false;
      }

      //my step up or step down
      if (myLullaby.step === undefined) {
        myLullaby.step = Math.round(Math.abs(config.step));
      }
      if (myLullaby.step == 0) {
        this.status({
          fill: "red",
          shape: "dot",
          text: "state: config error - step down or up value is 0 !  <" + timeConvert(Date.now()) + ">"
        });
        return;
      }

      // startTime, timestamp, not used in all
      if (myLullaby.startTime === undefined) {
        myLullaby.startTime = Date.now();
      }

      // dimming Time in seconds
      if (myLullaby.dimmingTime === undefined) {
        myLullaby.dimmingTime = config.dimmingTime * 1000;
      }

      // stopTime - not used in all
      if (myLullaby.stopTime === undefined) {
        myLullaby.stopTime = myLullaby.startTime + myLullaby.dimmingTime;
      }

      // dimming from startValue - positive int only
      if (myLullaby.startValue === undefined) {
        myLullaby.startValue = Math.round(Math.abs(config.startValue));
      }
      // dimming to stopValue - positive int only
      if (myLullaby.stopValue === undefined) {
        myLullaby.stopValue = Math.round(Math.abs(config.stopValue / 1));
      }

      // check if i have something to do...
      if (myLullaby.startValue == myLullaby.stopValue) {
        this.status({
          fill: "red",
          shape: "dot",
          text: "state: config error - startValue = stopValue  <" + timeConvert(Date.now()) + ">"
        });
        return;
      }
      if (myLullaby.startValue > myLullaby.stopValue) {
        myLullaby.direction = true; // true = direction down
      } else {
        myLullaby.directtion = false; // false = direction up
      }


      // my current dimm value is currValue
      if (myLullaby.currValue === undefined) {
        myLullaby.currValue = myLullaby.startValue;
      }

      /**
      i want to decrease by 1 in x time ...
      */
      // my dimming diference
      if (myLullaby.dimmingDifference === undefined) {
        myLullaby.dimmingDifference = Math.abs(myLullaby.startValue - myLullaby.stopValue);
      }

      // every how many seconds change the setting value = dimmingTime/ (dimmingDiference/step)
      var steps = Math.round(myLullaby.dimmingDifference / myLullaby.step);
      if (steps == 0) {
        steps = 1;
      }

      if (myLullaby.recallTime === undefined) {
        myLullaby.recallTime = Math.round(myLullaby.dimmingTime / steps);
      }

      // assign my Lullaby
      node.myLullaby = myLullaby;

      /*
      node.context().flow.set(node.variableName, myLullaby);
      */

      this.status({
        fill: "blue",
        shape: "ring",
        text: "state: starting... " + myLullaby.startValue + " -> " + myLullaby.stopValue + " <" + timeConvert(Date.now()) + ">"
      });

      msg = {
        payload: {
          value: myLullaby.currValue,
          timestamp: Date.now(),
          direction: (myLullaby.direction ? "down" : "up"),
          state: "counting"
        }
      }
      node.timeObject = setInterval(timeLoop, node.myLullaby.recallTime, node);
      node.send(msg);
    });
  }

  /**
  function timeConvert returns string from given timestamp as i.e.: 2010-10-1 17:09:11
  */
  function timeConvert(myTimeStamp) {
    var d = new Date(myTimeStamp);
    var time = [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('/') + ' ' + [d.getHours(), d.getMinutes(), d.getSeconds()].join(':');
    return time;
  }
  /**
  function timeLoop - loops my lullaby ;)
  */
  function timeLoop(childNode) {
    var myLullaby = childNode.myLullaby; //childNode.context().flow.get(variableName) || {};
    if (myLullaby.direction) { //direction down
      myLullaby.currValue = myLullaby.currValue - myLullaby.step;
    } else { //direction up
      myLullaby.currValue = myLullaby.currValue + myLullaby.step;
    }
    myLullaby.boxOrRing = !myLullaby.boxOrRing;
    //childNode.context().flow.set(variableName, myLullaby);

    childNode.status({
      fill: "green",
      shape: (myLullaby.boxOrRing ? "dot" : "ring"),
      text: "state: active " + myLullaby.startValue + " ->; " + myLullaby.stopValue + " value:" + myLullaby.currValue + " <" + timeConvert(Date.now()) + ">"
    });

    //normal message
    var msg = {
      payload: {
        value: myLullaby.currValue,
        timestamp: Date.now(),
        direction: (myLullaby.direction ? "down" : "up"),
        state: "counting"
      }
    }

    /**
    if we count down and 'currValue' is less than or equal to stopValue
    or
    if we count up and the 'currValue' value is at least equal to or greater than the stopValue value
    or
    if the time of planned blanking (increase) exceeded the blanking (increase) time + 1 step increase period 1

    -> counting must be completed
    */
    if ((myLullaby.currValue <= myLullaby.stopValue && myLullaby.direction) || (myLullaby.currValue >= myLullaby.stopValue && !myLullaby.direction) || myLullaby.stopTime + myLullaby.recallTime < Date.now()) {
      //ovverride message - currValue sholudn't < stopValue
      msg = {
        payload: {
          value: myLullaby.stopValue,
          timestamp: Date.now(),
          direction: (myLullaby.direction ? "down" : "up"),
          state: "end"
        }
      }

      childNode.status({
        fill: "red",
        shape: "dot",
        text: "state: ended " + myLullaby.startValue + " -> " + myLullaby.stopValue + " value:" + myLullaby.stopValue + " <" + timeConvert(Date.now()) + ">"
      });
      deleteInterval(childNode);
    }
    // send message
    childNode.send(msg);

  }
  /**
  function deleteInterval deletes my lullaby loop and cleans myLullaby in node
  */
  function deleteInterval(childNode) {
    if (childNode.timeObject !== undefined) {
      clearInterval(childNode.timeObject);
      delete childNode.timeObject;
    }
    delete childNode.myLullaby;


  }

  //register node
  RED.nodes.registerType("afya-lullaby", AFYALullaby);
}
