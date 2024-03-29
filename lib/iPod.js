import "core-js/stable";
import * as Bluebird from 'bluebird';
import BackendHelper from './backendHelper';
import EncodeHelper from './encodeHelper';

$(document).ready(async () => {
  let v; let up = 0; let down = 0; let i = 0; let
    menu = 0; let number = 0; let backlit = false;
  let songurl = [];
  let songtitle = [];
  let songartist = [];
  let songalbum = [];
  let songtrackno = [];
  let audioPlayer;

  function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }

  function getArrowSpan() {
    const arrowSpan = document.createElement('span');
    arrowSpan.classList.add('arrow');
    arrowSpan.innerText = '>';
    return arrowSpan;
  }

  var loadPlayer = function() {
    audioPlayer.src = songurl[number];
    audioPlayer.currentTime = 0;
  //controls the time and timebar
	$("#player audio").bind('timeupdate', function() {
		var currentTime = audioPlayer.currentTime;
    var rem = audioPlayer.duration - currentTime;
    if (rem < 0.1) {
      nextSong();
      return;
    }
	  //var rem = parseInt(audioPlayer.currentTime, 10),
    let pos = (currentTime / audioPlayer.duration) * 100;
    let minsTot = Math.floor(audioPlayer.duration/60, 10);
    let secsTot = Math.floor(audioPlayer.duration - minsTot*60)
	  let mins = Math.floor(rem/60,10);
		let secs = Math.floor(rem - mins*60);
    let minsElapsed = Math.floor((audioPlayer.duration - rem) / 60);
    let secsElapsed = secsTot - secs < 0 ? secsTot - secs + 60 : secsTot - secs;
    let newLeftText = minsElapsed + ':' + (secsElapsed > 9 ? secsElapsed : '0' + secsElapsed)
    let newRightText = "-"+mins + ':' + (secs > 9 ? secs : '0' + secs)

		$(".time-left").text(newLeftText);
	  $(".time-right").text(newRightText);
	  $(".trackbartime").css("width", pos+"%");
	  $(".scrolltimelevel").css("width", pos+"%");
  });
  
  //displays the play pause notification
	$("#pauseindicator").hide();
	$("#playindicator").show();
	var volume = audioPlayer.volume*100;
	$(".volumelevel").css("width",volume+"%");
    $(".tracknumber").text(songtrackno[number]);
	$(".songtitle").text(songtitle[number]);
	$(".songartist").text(songartist[number]);
  $(".albumtitle").text(songalbum[number]);
  audioPlayer.play();
  }

  //this button play/pauses the song and changes the indicator.
$("#playpausebutton").click(function(e){
  e.preventDefault();
      if (audioPlayer.paused)
          {
    audioPlayer.play();
    $("#pauseindicator").hide();
    $("#playindicator").show();
    }
      else
          {
    audioPlayer.pause();
    $("#pauseindicator").show();
    $("#playindicator").hide();
    }

});//end click playpause

//click the fast forward button
var count = 0; // this variable helps seperate single click and long presses
var timeout = 0;
$("#fastforwardbutton").click(function(e){
e.preventDefault();
		if (count < 1) {
			 number++;
			if(number == songurl.length)
			{ number--; }
			loadPlayer();
		}
			
			count = 0;
});


$("#fastforwardbutton").mousedown(function(){ 
timeout = setInterval(function(){
	if($("#audioplayer").is(":visible") == true)
	{
		audioPlayer.currentTime+=10;
		count++;
	}//end if
	
    }, 500);

    return false;
	
});

//this function clears the timeout variable
$("#fastforwardbutton").mouseup(function(){
    clearInterval(timeout);
    return false;
});
//end ffw


//click the rewind button
$("#rewindbutton").click(function(e){
	e.preventDefault();
	if (count < 1) {
    if (audioPlayer.currentTime > 4) {
      audioPlayer.currentTime = 0;
    } else {
      number--;
		if(number < 0)
		{ number++; }
		loadPlayer();
    }
	}
		
	count = 0;
});

$("#rewindbutton").mousedown(function(){ 
timeout = setInterval(function(){
	if($("#audioplayer").is(":visible") == true)
	{
		audioPlayer.currentTime-=10;
		count++;
	}//end if
	
    }, 500);

    return false;
	
});


$("#rewindbutton").mouseup(function(){
    clearInterval(timeout);
    return false;
});//end rwd

  //this function plays the net song in the song list when a song ends
function nextSong(){
	number++;
	if(number == songurl.length)
	{ 
	//number--; 
	number=0; 
  }
	loadPlayer();
}//end nextSong

  const incr = function () {
    i++;

    //start sound
    if($("#audioplayer").is(":visible") == true)
    {
      if($(".timeline").is(":visible") == true)
      {
        $(".timeline").hide();
        $(".volume").show();
        return;
      }//end inner if
      else if($(".scrolltime").is(":visible") == true){
        audioPlayer.currentTime+=5;
        return;
      }else{
        var volume = audioPlayer.volume;
        volume = volume + 0.1;
        
          if(volume > 1)
          volume = 1;
          
        audioPlayer.volume = volume;
        
        volume = audioPlayer.volume*100;
        $(".volumelevel").css("width",volume+"%");
        return;
      }
    
    }
    //end sound

    // code for scroll
    const current = $('.select');

    if ($(current).is(':last-child') == false) {
      $(current).removeClass('select');
      const next = $(current).next();
      $(next).addClass('select');
    }

    menu++; // count for current menu item

    if ($('.on ul a').length < menu + 1) {
      menu = $('.on ul a').length - 1;
    }

    if (menu > 5) {
      const rem = menu - 5;
      $(`.on ul a:nth-child(${rem})`).hide();
      $(`.on ul a:nth-child(${menu+1})`).show();
    }// end if
    // end scroll
  };

  const decr = function () {
    i--;

    //start sound
    if($("#audioplayer").is(":visible") == true)
    {
      if($(".timeline").is(":visible") == true)
      {
        $(".timeline").hide();
        $(".volume").show();
        return;
      }//end inner if
      else if($(".scrolltime").is(":visible") == true){
        audioPlayer.currentTime-=5;
        return;
      }else{
        var volume = audioPlayer.volume;
        volume = volume - 0.1;
        
          if(volume < 0)
          volume = 0;
          
        audioPlayer.volume = volume;
        
        volume = audioPlayer.volume*100;
        $(".volumelevel").css("width",volume+"%");
        return;
      }
    
    }
    //end sound
    $(`.on ul a:nth-child(${menu})`).show();

    // start scroll
    menu--; // count for current menu item
    if (menu < 0) {
      menu = 0;
    }
    // alert("unhide");

    const current = $('.select');


    if ($(current).is(':first-child') == false) {	// alert("last");
      $(current).removeClass('select');
      const prev = $(current).prev();
      $(prev).addClass('select');
    }


    if (menu > 5) {
      const rem = menu - 5;
      // alert(rem);
      $(`.on ul a:nth-child(${rem})`).hide();
    }// end if

    // end scroll
  };

  $('.dial').knob({
    min: 0,
    max: 20,
    stopper: false,
    change() {
      if (v > this.cv) {
        if (up) {
          decr();
          up = 0;
        } else { up = 1; down = 0; }
      } else if (v < this.cv) {
        if (down) {
          incr();
          down = 0;
        } else { down = 1; up = 0; }
      }
      v = this.cv;
    },
    release(v) {
      /* make something */
      // alert(v);
    },
  });

  $('#homemenu').addClass('on');
  let startup = true;
  press();

  function press(dir = 'fwd') {
    $('.tile').hide();

    if (!startup) {
      $('.on').show('slide', { direction: dir === 'fwd' ? 'right' : 'left' }, 210);
    } else {
      $('.on').show();
    }


    // select the first child of the menu
    if (startup || dir === 'fwd') {
      $('.select').removeClass();
      $('.on ul a:first-child').addClass('select');
    }
    if (startup) {
      startup = false;
    }
  }// end press

  const path = [];// used to store history
  $('#select').click((e) => {
    e.preventDefault();

    //this if is used to allow ffw and rwd using scroll button 
if($("#audioplayer").is(":visible") == true){
	if($(".timeline").is(":visible") == true){
		//alert("asdas");
		$(".timeline").hide();
		$(".scrolltime").show();
		return;
	}//inner if
	else if($(".scrolltime").is(":visible") == true){
		$(".scrolltime").hide();
		$(".timeline").show();
		return;
	}//else if
	else if($(".volume").is(":visible") == true){
		$(".volume").hide();
		$(".timeline").show();
		return;
	}//else if
  }//outer if

  if ($('.select').attr('id') === 'backlight-link') {
    let backgroundGrad = backlit ? 'linear-gradient(45deg,  rgba(170,167,160,1) 0%,rgba(193,190,185,1) 49%,rgba(191,190,185,1) 51%,rgba(203,202,197,1) 100%)' : 'linear-gradient(45deg, rgb(162, 175, 219) 0%, rgb(186, 194, 223) 49%, rgb(184, 192, 219) 51%, rgb(171, 182, 218) 100%)';
    document.getElementById('screen').style.background = backgroundGrad;
    backlit = !backlit;
    return;
  }

  if ($('.select').attr('id') === 'shuffle-setting-link') {
    e.preventDefault();
    const settings = ['Off', 'Albums', 'Songs'];
    let newIndex = settings.findIndex((setting) => setting == $('#shuffle-setting').text()) + 1;
    if (newIndex === settings.length) {
      newIndex = 0;
    }
    $('#shuffle-setting').text(settings[newIndex]);
    return;
  }

    number = 0;
    const clickedOnSong = $(".play").is(":visible") == true;
    const clickedShuffleAll = $('.select').attr('id') === 'shuffle-all-link';
    if(clickedOnSong || clickedShuffleAll) {
    
    songurl = [];
    songtitle = [];
    songartist = [];
    songalbum = [];
    songtrackno = [];
    
    var i = 0;
    let tracksInList;
    if (clickedOnSong) {
      let shuffleSetting = $('#shuffle-setting').text();
      tracksInList = $('.on a');
      if (shuffleSetting === 'Songs') {
        const selectedSong = $('.select').get()[0];
        tracksInList = [selectedSong].concat(Array.from(shuffle(tracksInList.filter(track => {
          return tracksInList[track] !== selectedSong}))));
      } else if (shuffleSetting === 'Albums') {
        const firstAlbum = $('.select').attr('album');
        let uniqueAlbums = shuffle([...new Set($.map(tracksInList, track => {
          return track.getAttribute('album')
        }))]).filter(album => album !== firstAlbum);
        uniqueAlbums.unshift(firstAlbum);
        tracksInList = [];
        uniqueAlbums.forEach(album => {
          tracksInList = tracksInList.concat(Array.from($(`.on a[album="${album}"]`)).sort(
            (a, b) => a.getAttribute('songID').toLowerCase().localeCompare(b.getAttribute('songID').toLowerCase())
          ));
        });
      }
    } else {
      tracksInList = $('#songs-list a');
      tracksInList = shuffle(tracksInList);
    }
    $(tracksInList).each(function () 
      {
      //var song = $(".on ul a.select li"); 
      var song = $(this);
      const songHref = song.attr("songID");
      var url = `${backendURL}/audio/${songHref}/${song.attr('album')}`
      var title = song.text()
      var artist = song.attr('artist');
      var album = song.attr("album");
      // set track number based on number of elements?
      var trackno = `${i+1} of ${tracksInList.length}`;
    
      songurl.push(url);
      songtitle.push(title);
      songartist.push(artist);
      songalbum.push(album);
      songtrackno.push(trackno);
      
      if( $(this).hasClass("select"))
      {
      number = i;
      }
      
      i++;
      });
      
      //alert(songtitle);
      
    }//end if

    let newon = $('.on');
    const back = $(newon).attr('id');
if($('.select').attr('href') == "#audioplayer")
	{
    if (clickedOnSong || clickedShuffleAll) {
      if(typeof audioPlayer === "undefined") {
        audioPlayer = new Audio();
      }
        audioPlayer.oncanplaythrough = "isAppLoaded";
        audioPlayer.autoplay = true;
        audioPlayer.controls="controls";
        audioPlayer.onended = nextSong;
        const nowPlayingLink = document.createElement('a');
        nowPlayingLink.id = 'nowplaying-link';
        nowPlayingLink.href = '#audioplayer';
        const nowPlayingText = document.createElement('li');
        nowPlayingText.textContent = 'Now Playing';
        nowPlayingLink.appendChild(nowPlayingText);
        nowPlayingLink.appendChild(getArrowSpan());
        document.getElementById("player").appendChild(audioPlayer);
        document.getElementById('homemenu-list').appendChild(nowPlayingLink);

      loadPlayer();
    } else {
      if (typeof audioPlayer === 'undefined'){
        return;
      }
    }		
  }
  path.push([back, $('.select').attr('id').split('-link')[0], menu]);
    newon.removeClass('on');
    newon = $('.select').attr('href');
  $(`'[id="${newon.slice(1, newon.length)}"]'`).addClass('on');

  if (menu !== 0) {
    menu = 0;
  }
  for (let index = 0; index < 7; index++) {
    $(`.on ul a:nth-child(${index})`).show();
  }
  for (let index = $('.on ul a').length; index >6; index--) {
    $(`.on ul a:nth-child(${index})`).hide();
  }
    press();
  });// end select click

  // clicking the back button
  $('#back').click((e) => {
    e.preventDefault();
    // go back to song when sound is shown
    if ($('#audioplayer').is(':visible') == true) {
      if ($('.volume').is(':visible') == true) {
        $('.volume').hide();
        $('.timeline').show();
        return;
        // end sound
      }// inner if
      if ($('.scrolltime').is(':visible') == true) {
        $('.scrolltime').hide();
        $('.timeline').show();
        return;
      }// else if
    }// outer if

    // alert("lol");
    if (path.length != 0) {
      const back = path.pop();
      menu = back[2];
      // alert(back);
      const newon = $('.on');
      newon.removeClass('on');
      $(`'[id="${back[0]}"]'`).addClass('on');
      $('.select').removeClass('select');
      $(`'[id="${back[1]}-link"]'`).addClass('select');
      up = 0;
      down = 0;
      v = undefined;

      press('back');
    }// end if
    else {
      menu = 0;
    }
  });// end back button

  async function getArtists() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/meta/music/artists`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function getAlbums() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/meta/music/albums`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function getSongs() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/meta/music/songs`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function getAlbumsForArtist(artistID) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/meta/music/artist/${artistID}/albums`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function getSongsForArtist(artistID) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/meta/music/artist/${artistID}/songs`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function getSongsForAlbum(album) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/meta/music/artist/${album.artist}/${album.name}`;
      request.open('GET', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  async function loadSongsMenu() {
    const Songs = await getSongs();
    Songs.forEach((song) => {
      const songLink = document.createElement('a');
      songLink.id = `${EncodeHelper.htmlString(song.album.name)}-${EncodeHelper.htmlString(song.id)}-link`;
      songLink.href = '#audioplayer';
      const songLi = document.createElement('li');
      songLi.innerText = song.title;
      songLink.setAttribute('artist', song.artist);
      songLink.setAttribute('album', song.album.name);
      songLink.setAttribute('songID', song.id)
      songLink.appendChild(songLi);
      document.getElementById('songs-list').appendChild(songLink);
    });
  }

  async function loadAlbumsMenu() {
    const Albums = await getAlbums();
    const promises = [];
    Albums.forEach((album) => {
      promises.push((async () => {
        const albumLink = document.createElement('a');
        albumLink.id = `${EncodeHelper.htmlString(album.name)}-${EncodeHelper.htmlString(album.artist)}-link`;
        albumLink.href = `#${EncodeHelper.htmlString(album.name)}-${EncodeHelper.htmlString(album.artist)}`;
        const albumLi = document.createElement('li');
        albumLi.innerText = album.name;
        albumLink.appendChild(albumLi);
        albumLink.appendChild(getArrowSpan());
        document.getElementById('albums-list').appendChild(albumLink);
        const albumData = await getSongsForAlbum(album);
        const songTile = document.createElement('div');
        songTile.id = `${EncodeHelper.htmlString(album.name)}-${EncodeHelper.htmlString(album.artist)}`;
        songTile.style.display = 'none';
        songTile.classList.add('tile');
        songTile.classList.add('play');
        const titleDiv = document.createElement('div');
        titleDiv.classList.add('title');
        const titleSpan = document.createElement('span');
        titleSpan.innerText = album.name;
        titleDiv.appendChild(titleSpan);
        const songList = document.createElement('ul');
        songList.id = `${EncodeHelper.htmlString(album.name)}-${EncodeHelper.htmlString(album.artist)}-list`;
        albumData.tracks.forEach((song) => {
          const songLink = document.createElement('a');
          songLink.id = `${EncodeHelper.htmlString(album.name)}-${EncodeHelper.htmlString(song.id)}-link`;
          songLink.href = '#audioplayer';
          const songName = document.createElement('li');
          songName.innerText = song.name;
          songLink.setAttribute('artist', song.artist ? song.artist : albumData.albumArtist);
          songLink.setAttribute('album', album.name);
          songLink.setAttribute('songID', song.id)
          songLink.appendChild(songName);
          songList.appendChild(songLink);
        });
        songTile.appendChild(titleDiv);
        songTile.appendChild(songList);
        document.getElementById('screen').appendChild(songTile);
      })());
    });

    await Bluebird.all(promises);
    const songsByAlbumList = document.getElementById('songs-by-album-list');
    Albums.forEach(album => {
      const tracks = document.getElementById(`${EncodeHelper.htmlString(album.name)}-${EncodeHelper.htmlString(album.artist)}-list`)
        .getElementsByTagName('a');
      Array.from(tracks).forEach(track => {
        songsByAlbumList.appendChild(track.cloneNode(true));
      });
    });
  }

  async function loadArtistsMenu() {
    const Artists = await getArtists();
    const promises = [];
    Artists.forEach((artist) => {
      promises.push((async () => {
        const artistLink = document.createElement('a');
        artistLink.id = `${EncodeHelper.htmlString(artist)}-link`;
        artistLink.href = `#${EncodeHelper.htmlString(artist)}`;
        const artistLi = document.createElement('li');
        artistLi.innerText = artist;
        artistLink.appendChild(artistLi);
        artistLink.appendChild(getArrowSpan());
        document.getElementById('artists-list').appendChild(artistLink);
        const albums = await getAlbumsForArtist(artist);
        const albumsTile = document.createElement('div');
        albumsTile.id = EncodeHelper.htmlString(artist);
        albumsTile.style.display = 'none';
        albumsTile.classList.add('tile');
        let titleDiv = document.createElement('div');
        titleDiv.classList.add('title');
        let titleSpan = document.createElement('span');
        titleSpan.innerText = artist;
        titleDiv.appendChild(titleSpan);
        const albumsList = document.createElement('ul');
        albumsList.id = `${EncodeHelper.htmlString(artist)}-list`;
        const allLink = document.createElement('a');
        allLink.id = `${artist}-all-songs-link`;
        allLink.href = `#${EncodeHelper.htmlString(artist)}-all-songs`;
        const allTitle = document.createElement('li');
        allTitle.innerText = 'All';
        allLink.appendChild(allTitle);
        allLink.appendChild(getArrowSpan());
        albumsList.appendChild(allLink);
        albums.forEach((album) => {
          const albumLink = document.createElement('a');
          albumLink.id = `${artist}-${album}-link`;
          albumLink.href = `#${EncodeHelper.htmlString(album)}-${EncodeHelper.htmlString(artist)}`;
          const albumName = document.createElement('li');
          albumName.innerText = album;
          albumLink.appendChild(albumName);
          albumLink.appendChild(getArrowSpan());
          albumsList.appendChild(albumLink);
        });
        albumsTile.appendChild(titleDiv);
        albumsTile.appendChild(albumsList);
        document.getElementById('screen').appendChild(albumsTile);
        const songsTile = document.createElement('div');
        songsTile.id = `${EncodeHelper.htmlString(artist)}-all-songs`;
        songsTile.style.display = 'none';
        songsTile.classList.add('tile');
        songsTile.classList.add('play');
        titleDiv = document.createElement('div');
        titleDiv.classList.add('title');
        titleSpan = document.createElement('span');
        titleSpan.innerText = 'All Songs';
        titleDiv.appendChild(titleSpan);
        songsTile.appendChild(titleDiv);
        const songList = document.createElement('ul');
        songList.id = `${EncodeHelper.htmlString(artist)}-all-songs-list`;
        const songs = await getSongsForArtist(artist);
        songs.forEach(song => {
          const songLink = document.createElement('a');
          songLink.id = `${EncodeHelper.htmlString(song.album.name)}-${EncodeHelper.htmlString(song.id)}-link`;
          songLink.href = '#audioplayer';
          const songLi = document.createElement('li');
          songLi.innerText = song.title;
          songLink.setAttribute('artist', song.artist);
          songLink.setAttribute('album', song.album.name);
          songLink.setAttribute('songID', song.id)
          songLink.appendChild(songLi);
          songList.appendChild(songLink);
        });
        songsTile.appendChild(songList);
        document.getElementById('screen').appendChild(songsTile);
      })());
    });
    await Bluebird.all(promises);
    const albumsByArtistLink = document.getElementById('albums-by-artist-list');
    const songsByAlbumByArtistList = document.getElementById('songs-by-album-by-artist-list');
    Artists.forEach(artist => {
      const albums = document.getElementById(`${EncodeHelper.htmlString(artist)}-list`)
        .getElementsByTagName('a');
        Array.from(albums).filter(album => !album.id.includes('-all-songs-link')).forEach(album => {
          albumsByArtistLink.appendChild(album.cloneNode(true));
          Array.from(document.getElementById(album.getAttribute('href').slice(1)).getElementsByTagName('a')).forEach(songLink => {
            songsByAlbumByArtistList.appendChild(songLink.cloneNode(true));
          });
        });
    });
  }

  await loadAlbumsMenu();
  await loadArtistsMenu();
  await loadSongsMenu();
});
