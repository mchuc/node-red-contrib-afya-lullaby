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

      // exit, if timeObject - also Loop exists
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

      // dimming from startValue
      if (myLullaby.startValue === undefined) {
        myLullaby.startValue = config.startValue;
      }
      // dimming to stopValue
      if (myLullaby.stopValue === undefined) {
        myLullaby.stopValue = config.stopValue;
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

      // every how many seconds change the setting value = dimmingTime/dimmingDiference
      if (myLullaby.recallTime === undefined) {
        myLullaby.recallTime = Math.round(myLullaby.dimmingTime / myLullaby.dimmingDifference);
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
          timestamp: Date.now()
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
    myLullaby.currValue = myLullaby.currValue - 1;
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
        timestamp: Date.now()
      }
    }


    if (myLullaby.currValue <= myLullaby.stopValue) {
      //ovverride message - currValue sholudn't < stopValue
      msg = {
        payload: {
          value: myLullaby.stopValue,
          timestamp: Date.now()
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
