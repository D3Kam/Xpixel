// Removes any existing marked area from the frame.
function clearMark() {
    const frame = document.getElementById('frame');
    const existingMark = document.querySelector('.mark');
    if (existingMark) {
      frame.removeChild(existingMark);
    }
}

// Creates and positions the marked area within the main frame.
function markArea(width, height) {
  clearMark();
  const frame = document.getElementById('frame');
  const mark = document.createElement('div');
  mark.className = 'mark';
  mark.style.width = width + 'px';
  mark.style.height = height + 'px';
  // Center the marked area in the frame.
  mark.style.left = (frame.clientWidth - width) / 2 + 'px';
  mark.style.top = (frame.clientHeight - height) / 2 + 'px';
  frame.appendChild(mark);
}

// Retrieves custom dimensions from the inputs and marks the area.
function markCustom() {
  const customWidth = parseInt(document.getElementById('customWidth').value);
  const customHeight = parseInt(document.getElementById('customHeight').value);
  if (isNaN(customWidth) || isNaN(customHeight)) {
    alert('Please enter valid dimensions.');
    return;
  }
  markArea(customWidth, customHeight);
}

// Repositions the marked area based on the selected position.
function repositionArea(position) {
  const mark = document.querySelector('.mark');
  if (!mark) {
    alert('Please create a marked area first.');
    return;
  }
  const frame = document.getElementById('frame');
  const markWidth = mark.offsetWidth;
  const markHeight = mark.offsetHeight;
  let left = 0, top = 0;

  switch(position) {
    case 'top-left':
      left = 0;
      top = 0;
      break;
    case 'top-middle':
      left = (frame.clientWidth - markWidth) / 2;
      top = 0;
      break;
    case 'top-right':
      left = frame.clientWidth - markWidth;
      top = 0;
      break;
    case 'middle-left':
      left = 0;
      top = (frame.clientHeight - markHeight) / 2;
      break;
    case 'middle-middle':
      left = (frame.clientWidth - markWidth) / 2;
      top = (frame.clientHeight - markHeight) / 2;
      break;
    case 'middle-right':
      left = frame.clientWidth - markWidth;
      top = (frame.clientHeight - markHeight) / 2;
      break;
    case 'bottom-left':
      left = 0;
      top = frame.clientHeight - markHeight;
      break;
    case 'bottom-middle':
      left = (frame.clientWidth - markWidth) / 2;
      top = frame.clientHeight - markHeight;
      break;
    case 'bottom-right':
      left = frame.clientWidth - markWidth;
      top = frame.clientHeight - markHeight;
      break;
  }
  mark.style.left = left + 'px';
  mark.style.top = top + 'px';
}

// Handles the custom image upload and displays it in the marked area.
function uploadImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageDataUrl = e.target.result;
    const mark = document.querySelector('.mark');
    if (!mark) {
      alert('Please create a marked area first.');
      return;
    }
    // Clear any existing content in the marked area.
    mark.innerHTML = '';
    // Create an image element that fills the marked area.
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    mark.appendChild(img);
  };
  reader.readAsDataURL(file);
}
