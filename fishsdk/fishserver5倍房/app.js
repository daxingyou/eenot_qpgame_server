﻿var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var schedule = require("node-schedule");
var signCode = "slel3@lsl334xx,deka";
var Cio = require('socket.io-client')



var gameInfo = require('./class/game').getInstand;
var gameConfig = require('./config/gameConfig');

var Csocket = Cio('http://localhost:3000');


Csocket.on('disconnect', function(data){
  console.log("登录服务器被断开")
});

Csocket.on('connected',function(msg){
    console.log("与登录服务器进行连接......");
    var info = {serverName:"捕鱼游戏",serverId:gameConfig.serverId,signCode:"slel3@lsl334xx,deka"}
    Csocket.emit('GameServerConnect',info)
})

Csocket.on('GameServerConnectResult',function(msg){
  if (msg.resultCode){
    console.log("连接成功");
  }
})


Csocket.on('LoginGameResult',function(msg){
  if (!msg){
    return;
  }
  //console.log("test5.登录服务器回应" + msg)
  if (msg.ResultCode){
    gameInfo.updateUser(msg.userInfo);
  }else{
    gameInfo.deleteUserById(msg.userid,msg.msg);
    console.log("玩家登录不成功!删除");
  }
  
})

Csocket.on('addgold',function(msg){
  if (!msg){
    return;
  }
  console.log(msg);
  var result = gameInfo.addgold(msg.userid,msg.addgold);
  Csocket.emit('addgoldResult',{Result:result});

  //当前用户桌子广播
  var User = gameInfo.getUser(msg.userid);
  if (User){
    var tablestring = "table" + User.getTable();
    io.sockets.in(tablestring).emit('userGoldUpdate', {userId:msg.userid,updateSocre:User.getScore()});
  }
})

Csocket.on('getgold',function(msg){
  if (!msg){
    return;
  }

  console.log(msg);
  var score = gameInfo.getPlayerScore(msg.userid);
  Csocket.emit('getgoldResult',{Result:1,score:score});
  
})

Csocket.on('disconnectUser',function(msg){
  //console.log("disconnectUser" + msg.userId);
  var list = gameInfo.getOnlinePlayer();
  if (list[msg.userId]){
    list[msg.userId]._socket.disconnect();
  }else{
        console.log("用户不存在");
    var result = {ResultCode:0,userId:msg.userId};
    Csocket.emit("userDisconnect",result);
  }
})

Csocket.on('Setmaintain',function(msg){
  console.log("关闭服务");
  gameInfo.Setmaintain();

})

Csocket.on('applyMatchResult',function(_info){
    //console.log(_info);
    gameInfo.addRankUserList(_info);
    //gameInfo.fishShoot(socket,fishShootInfo);
  })

gameInfo.setIo(io,Csocket);

io.on('connection', function(socket){

  //console.log(socket + 'connected');
  socket.emit('connected', 'connect game server');


  //客户登录游戏
  socket.on('LoginGame',function(GameInfo){
    //console.log("LoginGame")
    //console.log("test1.进入房间")
    //console.log(GameInfo)
    if (!GameInfo) {
      console.log("登录游戏,参数不正确!");
    }

    if (GameInfo.sign){
      if (!gameInfo.getUser(GameInfo.userid)){
        gameInfo.addUser(GameInfo,socket);
        var msg = {userid:GameInfo.userid,sign:GameInfo.sign,gameId:gameInfo.serverId,serverSign:signCode}
        Csocket.emit('LoginGame',msg);
        //console.log("test4.发送新用户登录完成,让登录服务器删除用户")
      }else{
        console.log("用户已经在服务器了，无需重复登录");
      }
    }

  })

  //报名
  socket.on('applyMatch',function(Info){
    //var time = makeDate(new Date());
    //console.log(time);
    gameInfo.ApplyMatch(socket.userId,Info.roomid,socket)
  })

  //然后再登录房间
  socket.on('LoginRoom',function(RoomInfo){
    //roomtype
    //如果没有房间概念，就默认为1
    //这还应该检测是否进入了游戏，如果没有需要先进入
    //console.log("进入房间")
    gameInfo.LoginRoom(socket.userId,RoomInfo.roomid,socket)
  })


  //离开房间
  socket.on('LogoutRoom',function(){
    gameInfo.LogoutRoom(socket);
  })

  //捕中鱼
  socket.on('fishHit',function(hitInfo){
    //console.log("中鱼" + hitInfo)
    var hitSocre = gameInfo.fishHit(socket.userId,hitInfo.fishId,hitInfo.bulletId,hitInfo.sendId);
  })

  //发射子弹
  socket.on('fishShoot',function(fishShootInfo){
    //console.log(fishShootInfo)
    //用户,发射角度,子弹类型,子弹ID
    gameInfo.fishShoot(socket,fishShootInfo);
  })

  //获取排行榜
  socket.on('getMatchRoom',function(){
    gameInfo.getMatchRoom(socket);
  })



  //离线操作
  socket.on('disconnect',function(){
    //console.log("test8.用户断线")
    if (!socket.userId){
      return;
    }
    //通知登录服务器，已经下线存储游戏数据
    //console.log(socket.userId)
    var userInfo = gameInfo.getUser(socket.userId);
    if (userInfo){
      if (userInfo.Islogin()){
        if (gameConfig.isMatchRoom){
          //是比赛房间
          //储蓄自己的数据
          console.log("储存数据")
          gameInfo.updateMatchRandKing(socket.userId,function(ResultCode){
            if (userInfo._Apply){
              var result = {ResultCode:1,userId:userInfo._userId,userScore:userInfo._bankScore,gameId:gameConfig.serverId};
              Csocket.emit("userDisconnect",result);
            }else{
              var result = {ResultCode:1,userId:userInfo._userId,userScore:userInfo._score,gameId:gameConfig.serverId};
              Csocket.emit("userDisconnect",result);              
            }

            //断线存储相应数据(在新的数据库里存储,消耗子弹与收获金币)
            gameInfo.deleteUser(socket);
            socket.userId = null;

          })
          //score
          //最后score变化时间
          //

        }else{
          var result = {ResultCode:1,userId:userInfo._userId,userScore:userInfo._score,gameId:gameConfig.serverId};
          Csocket.emit("userDisconnect",result);
          //断线存储相应数据(在新的数据库里存储,消耗子弹与收获金币)
          gameInfo.deleteUser(socket);
          socket.userId = null;
        }

      }else{
        console.log("用户未登录离开!")
      }
      // else{
      //   var result = {ResultCode:0,userId:userInfo._userId};
      //   Csocket.emit("userDisconnect",result);
      // }
    }

  })

});


app.set('port', process.env.PORT || 3102);

var server = http.listen(app.get('port'), function() {
  console.log('start at port:' + server.address().port);
});

console.log("捕鱼游戏服务器启动");


var rule = new schedule.RecurrenceRule();
//每到55秒
//rule.seconds = 55;
//正常模式
//rule.minute = 55;

var j = schedule.scheduleJob(rule, function(){
  //client.write('111111');
  //console.log("11111");
});



