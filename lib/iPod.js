import 'babel-polyfill';
import BackendHelper from './backendHelper';

$(document).ready(function() {
  var v, up=0,down=0,i=0, menu=0;

  loadArtistsMenu();
  loadAlbumsMenu();
  loadSongsMenu();

  var incr = function() { 
    i++;  
  
    
    //code for scroll
    var current = $(".select");
    
    if( $(current).is(':last-child') == false )
    {
      $(current).removeClass('select');
      var next = $(current).next();
      $(next).addClass('select');
    }
    
    menu++; //count for current menu item
    
    if($(".on ul a").length < menu+1)
    {
    menu = $(".on ul a").length-1;
    }
    
    if(menu > 5)
    {
      var rem = menu - 5;
      $(".on ul a:nth-child("+rem+")").hide();
    
    }//end if
    //end scroll
    
  };

  var decr = function() {
    i--;

    //start scroll
    menu--; //count for current menu item
    if(menu < 0)
    {
    menu = 0;
    }
    
    $(".on ul a:nth-child("+menu+")").show();//this shows the menu which comes before this one, if it is hidden
    //alert("unhide");
    
    var current = $(".select");

    console.log('current:');
    console.log(current);
    console.log(`is current the first child? ${$(current).is(':first-child')}`)
  
    if( $(current).is(':first-child') == false )
    {	//alert("last");
      $(current).removeClass('select');
      var prev = $(current).prev();
      $(prev).addClass('select');
    }
    
    
    
    if(menu > 5)
    {
      var rem = menu - 5;
      //alert(rem);
      $(".on ul a:nth-child("+rem+")").hide();
    
    }//end if
    
    //end scroll
  };

  $(".dial").knob({
              min : 0
      , max : 20
      , stopper : false
      , change : function () {
        if(v > this.cv){
								
          if(up){
            decr();
            up=0;
          }
          else{up=1;down=0;}
        } else {
        if(v < this.cv){
            if(down){
              incr();
              down=0;
            }else{down=1;up=0;}
          }
        }
        v = this.cv;
        console.log(`v: ${v}`);
        console.log(`menu at end of dial interaction: ${menu}`);
        console.log(`down is ${down} and up is ${up}`);
            }
      ,'release' : function (v) {
      /*make something*/ 
      //alert(v);
      }
  });

  $("#homemenu").addClass("on");
  var startup = true;
  press();

  function press(dir='fwd'){
    $(".tile").hide();
 
    if (!startup) {
      $(".on").show('slide', {direction: dir === 'fwd' ? 'right' : 'left'}, 210);
    } else {
      $(".on").show();
    }

    
    //select the first child of the menu
    if (startup || dir === 'fwd') {
    $(".select").removeClass();
    $(".on ul a:first-child").addClass("select");
    }
    if (startup) {
      startup = false;
    }
    }//end press

    var path =[];//used to store history
console.log('path')
console.log(path);
$("#select").click(function(e){
  e.preventDefault();

  var newon = $(".on");
	var back = $(newon).attr('id');
  path.push([back, $(".select").attr('href').split('#')[1], menu]);
  menu=0;//reset menu;
	newon.removeClass("on");
	newon = $(".select").attr('href');
  $(newon).addClass("on");
  console.log(path);
    
    press();
  });//end select click

  //clicking the back button
$("#back").click(function(e){
  e.preventDefault();
  //go back to song when sound is shown
    if($("#audioplayer").is(":visible") == true){
    if($(".volume").is(":visible") == true)
    {
      $(".volume").hide();
      $(".timeline").show();
      return;
    //end sound
    }//inner if
    else if($(".scrolltime").is(":visible") == true){
      $(".scrolltime").hide();
      $(".timeline").show();
      return;
    }//else if
    
    }//outer if
    
      //alert("lol");
      if(path.length != 0)
      {
        var back = path.pop();
        menu = back[2];
        //alert(back);
        var newon = $(".on");
        newon.removeClass("on");
        $("#"+back[0]).addClass("on");
        $('.select').removeClass('select');
        $(`#${back[1]}-link`).addClass('select');
        up = 0;
        down = 0;
        v = undefined;
        
        press('back');
      }//end if
      else {
        menu = 0;
      }	
      
  });//end back button

  async function getArtists() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/music/meta/artist`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function getAlbums() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/music/meta/album`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function getSongs() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/music/meta/song`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function loadSongsMenu() {
    const {Songs} = await getSongs();
    console.log('songs:');
    console.log(Songs);
    Songs.forEach(song => {
      const songLink = document.createElement('a');
      songLink.id = `${song[0]}-link`;
      songLink.href = `#${song[0]}`;
      const songLi = document.createElement('li');
      songLi.innerText = song[1];
      songLink.appendChild(songLi);
      const arrowSpan = document.createElement('span');
      arrowSpan.classList.add('arrow');
      arrowSpan.innerText = '>';
      songLink.appendChild(arrowSpan);
      document.getElementById('songs-list').appendChild(songLink);
    });
  }

  async function loadAlbumsMenu() {
    const {Albums} = await getAlbums();
    Albums.forEach(album => {
      const albumLink = document.createElement('a');
      albumLink.id = `${album[0]}-link`;
      albumLink.href = `#${album[0]}`;
      const albumLi = document.createElement('li');
      albumLi.innerText = album[1];
      albumLink.appendChild(albumLi);
      const arrowSpan = document.createElement('span');
      arrowSpan.classList.add('arrow');
      arrowSpan.innerText = '>';
      albumLink.appendChild(arrowSpan);
      document.getElementById('albums-list').appendChild(albumLink);
    });
  }

  async function loadArtistsMenu() {
    const {Artists} = await getArtists();
    Artists.forEach(artist => {
      const artistLink = document.createElement('a');
      artistLink.id = `${artist[0]}-link`;
      artistLink.href = `#${artist[0]}`;
      const artistLi = document.createElement('li');
      artistLi.innerText = artist[1];
      artistLink.appendChild(artistLi);
      const arrowSpan = document.createElement('span');
      arrowSpan.classList.add('arrow');
      arrowSpan.innerText = '>';
      artistLink.appendChild(arrowSpan);
      document.getElementById('artists-list').appendChild(artistLink);
    });
  }
});
