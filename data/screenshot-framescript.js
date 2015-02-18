// FIXME: this is a hack to take a shot of the iframe in the viewer
// instead of the container
function getWindow() {
  if (content.document.getElementById("frame")) {
    return content.document.getElementById("frame").contentWindow;
  }
  return content;
}

function makeScreenShot(pos, maxSize, backgroundColor) {
  console.log("shooting area", pos.x, pos.y, "w/h", pos.w, pos.h, !!maxSize);
  var canvas = content.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
  if (maxSize) {
    canvas.width = maxSize.w;
    canvas.height = maxSize.h;
  } else {
    canvas.width = pos.w;
    canvas.height = pos.h;
  }
  let ctx = canvas.getContext('2d');
  if (maxSize) {
    ctx.scale(maxSize.w / pos.w, maxSize.h / pos.h);
  }
  backgroundColor = backgroundColor || "#000";
  ctx.drawWindow(getWindow(), pos.x, pos.y, pos.w, pos.h, backgroundColor);
  return canvas.toDataURL();
}

addMessageListener("pageshot@pageshot:request-screenshot", function handler(event) {
  var result;
  try {
    result = {
      imageUrl: makeScreenShot(event.data.pos, event.data.maxSize, event.data.backgroundColor)
    };
  } catch (e) {
    console.log("Error making shot:", e);
    console.trace();
    result = {
      error: {
        name: e.name,
        description: e+""
      }
    };
  }
  result.contextId = event.data.contextId;
  sendAsyncMessage("pageshot@pageshot:get-screenshot", result);
});
