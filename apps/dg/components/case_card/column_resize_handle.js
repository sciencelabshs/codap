/* global createReactFC, PropTypes, React, ReactDOMFactories */

DG.React.ready(function () {
  var div = ReactDOMFactories.div;

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  DG.React.DragHandle = createReactFC({
    displayName: "DragHandle",
    propTypes: {
      className: PropTypes.string,
      touchId: PropTypes.string,
      onUpdateDrag: PropTypes.func.isRequired,
      onEndDrag: PropTypes.func.isRequired
    }
  }, function(props) {
    var useDragOnDemand = DG.React.useDragOnDemand;

    useDragOnDemand(props.touchId, props.onUpdateDrag, props.onEndDrag);

    return div({ className: props.className });
  });

  DG.React.ColumnResizeHandle = createReactFC({
    displayName: "ColumnResizeHandle",
    propTypes: {
      containerWidth: PropTypes.number,
      columnWidth: PropTypes.number,
      minWidth: PropTypes.number.isRequired,
      onResize: PropTypes.func
    }
  }, function(props) {

    var isResizingState = React.useState(false),
        isResizing = isResizingState[0],
        setIsResizing = isResizingState[1],
        resizeWidthState = DG.React.useRefState(null),
        resizeWidth = resizeWidthState[0],
        resizeWidthRef = resizeWidthState[1],
        setResizeWidth = resizeWidthState[2],
        touchIdState = React.useState(null),
        touchId = touchIdState[0],
        setTouchId = touchIdState[1],
        deltaStartRef = React.useRef();

    React.useLayoutEffect(function() {
      setResizeWidth(props.columnWidth);
    }, [props.columnWidth, setResizeWidth]);

    function beginResize(e) {
      deltaStartRef.current = e.pageX - resizeWidthRef.current;
      setIsResizing(true);
    }

    function continueResize(e) {
      var newWidth = e.pageX - deltaStartRef.current,
          minWidth = props.minWidth || 20,
          maxWidth = props.containerWidth - minWidth;
      newWidth = Math.max(newWidth, minWidth);
      newWidth = Math.min(newWidth, maxWidth);
      deltaStartRef.current = e.pageX - newWidth;
      if (newWidth !== resizeWidthRef.current) {
        props.onResize && props.onResize(newWidth);
        setResizeWidth(newWidth);
      }
    }

    function endResize() {
      if (props.onResize) {
        props.onResize(resizeWidthRef.current, true);
      }
      setIsResizing(false);
    }

    function handleMouseDown(e) {
      if (!props.enabled || isResizing || (e.button !== 0)) return;
      beginResize(e);
      stop(e);
    }

    function handleInitialTouch(e) {
      if (!props.enabled || isResizing) return;

      var touch = e.changedTouches[0];
      setTouchId(touch.identifier);
      beginResize(touch);

      stop(e);
    }

    var style = resizeWidth != null
                  ? { left: resizeWidth }
                  : null;
    return (
      (props.enabled || isResizing) &&
        div({
          className: props.className + ' column-resize-handle dg-wants-mouse dg-wants-touch',
          onMouseDown: handleMouseDown,
          onTouchStart: handleInitialTouch,
          style: style
        },
        isResizing && DG.React.DragHandle({
          className: "column-resize-handle-render is-resizing",
          touchId: touchId,
          onUpdateDrag: continueResize,
          onEndDrag: endResize
        }))
    );

  });
});
