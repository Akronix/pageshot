$(function () {

  $(document).on("click", ".closer", function (event) {
    // FIXME: need to change to use the new pattern
    var item = $(event.target).closest(".item");
    var path = item.attr("data-path");
    var comment = item.find(".comment").text();
    var collectionName = $(document.body).attr("data-collection-name");
    comment = comment.replace(new RegExp("\\s*\\#" + collectionName, "ig"), "");
    item.find(".comment").html(htmlize(comment));
    updateTags(path, item.find(".comment"));
    item.remove();
    updateResource("/meta" + path, function (data) {
      data.comment = comment;
      return data;
    }).then(function () {
      console.log("Removed #" + collectionName + " from comment");
    }, function (err) {
      console.log("Error removing #" + collectionName + ":", err);
    });
  });

  $(document).on("click", ".image-up, .image-down", function (event) {
    var isUp = $(event.target).hasClass("image-up");
    var el = $(event.target).closest(".item");
    var path = el.attr("data-path");
    var current = el.find(".item-shot");
    var images = JSON.parse(el.attr("data-images"));
    var index;
    for (var i=0; i<images.length; i++) {
      var imageItem = images[i];
      if (imageItem.src == current.attr("src")) {
        index = i;
        break;
      }
    }
    var next;
    if (isUp) {
      next = index + 1;
      if (next >= images.length) {
        next = 0;
      }
    } else {
      next = index - 1;
      if (next < 0) {
        next = images.length - 1;
      }
    }
    var nextImage = images[next];
    current.attr("src", nextImage.src).attr("title", nextImage.title || "");
    updateResource("/meta" + path, function (data) {
      data['activeImage'] = next;
      return data;
    }).then(function () {
      console.log("Image change saved");
    }, function (err) {
      console.log("Image change failed:", err);
    });
  });

  $(document).on("click", ".item-title", function (event) {
    if (! event.shiftKey) {
      return undefined;
    }
    var title = $(event.target);
    var path = title.closest(".item").attr("data-path");
    var el = $('<input type="text" class="title-replacement" style="width: 400px">');
    el.val(title.text());
    title.after(el);
    title.hide();
    el.keypress(function (event) {
      if (event.which == 13) {
        submit();
        return false;
      }
      if (event.keyCode == 27) {
        el.remove();
        title.show();
        return false;
      }
      return undefined;
    });
    el.focus();
    el[0].setSelectionRange(el.val().length, el.val().length);
    function submit() {
      var newTitle = el.val();
      el.remove();
      title.text(newTitle);
      title.show();
      updateResource("/meta", function (data) {
        data.userTitle = newTitle;
      }).then(function () {
        console.log("Saved new title");
      }, function (err) {
        console.log("Error putting meta:", err);
      });
    }
    return false;
  });

  $(document).on("click", ".add-comment, .comment", function (event) {
    var item = $(event.target).closest(".item");
    item.find(".comment-container").removeClass("comment-collapsed");
    item.find(".comment").hide();
    item.find(".add-comment").hide();
    item.find(".comment-editor-container").show();
    var text = item.find(".comment").text();
    var $editor = item.find(".comment-editor");
    $editor.val(text).focus()[0].setSelectionRange(text.length, text.length);
  });

  $(document).on("keypress", ".comment-editor", function (event) {
    var item = $(event.target).closest(".item");
    if (event.keyCode == 27) {
      closeEditor(item);
      return false;
    } else if (event.keyCode == 13 && ! (event.shiftKey || event.ctrlKey)) {
      var text = item.find(".comment-editor").val();
      item.find(".comment").html(htmlize(text));
      closeEditor(item);
      updateResource("/meta" + item.attr("data-path"), function (data) {
        data.comment = text;
        return data;
      }).then(function () {
        console.log("comment saved");
      }, function (err) {
        console.log("comment could not be saved:", err);
      });
      updateTags(item.attr("data-path"), item.find(".comment"));
      // FIXME: should detect if tag is removed (or I could refused to remove the tag?)
      return false;
    }
    return undefined;
  });

  function closeEditor(item) {
    item.find(".comment-editor-container").hide();
    var text = item.find(".comment").text();
    if (text) {
      item.find(".comment").show();
    } else {
      item.find(".add-comment").show();
      item.addClass("commen-collapsed");
    }
  }

});