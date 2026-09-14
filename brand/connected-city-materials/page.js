const choice = document.getElementById('film-choice');
const player = document.getElementById('film-player');
const message = document.getElementById('film-message');
choice.addEventListener('change', () => {
  player.pause();
  player.src = `media/${choice.value}.mp4`;
  player.poster = `media/${choice.value}.png`;
  player.querySelector('track')?.remove();
  if (choice.value === 'Omerta-ConnectedCity') {
    const track = document.createElement('track');
    Object.assign(track, {kind: 'captions', src: 'media/Omerta-ConnectedCity.vtt', srclang: 'en', label: 'English'});
    player.append(track);
  }
  document.getElementById('film-download').href = player.src;
  message.textContent = `${choice.selectedOptions[0].textContent}. Press play when ready.`;
  player.load();
});
player.addEventListener('error', () => {message.textContent = 'Video playback is unavailable in this browser. Download the film to watch it locally.';});
