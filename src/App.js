import "./styles.css";
import React from "react";
import { useInView } from "react-intersection-observer";

const Box = ({ color, height, idx }) => {
  const ref = React.useRef();
  const { entry, ref: inViewRef, inView } = useInView();
  const { actions, dispatch, state } = useInViewContext();

  // Use `useCallback` so we don't recreate the function on each render
  const setRefs = React.useCallback(
    (node) => {
      // Ref's from useRef needs to have the node assigned to `current`
      ref.current = node;
      // Callback refs, like the one from `useInView`, is a function that takes the node as an argument
      inViewRef(node);
    },
    [inViewRef]
  );

  React.useEffect(() => {
    if (!!inView) {
      dispatch({
        type: actions.SET_IN_VIEW,
        payload: {
          color,
          entry,
          ref: setRefs
        }
      });
    } else {
      dispatch({
        type: actions.REMOVE_IN_VIEW,
        payload: {
          color
        }
      });
    }
  }, [inView]);

  // /**
  //   this function gets added to the activeItem (returned by the InView context) when there is a scroll
  //   and removed when no longer the activeItem
  //   the InView visible items is a queue of ALL visible items within the viewport.
  //   The activeItem is the top element in that queue.
  //   When an element is out of view, the element is removed from the queue.
  //   This function calculates how much the active item is inView.
  //   If the item is 80% in view, scrolling DOWN, and there is at least one other visible element
  //   => it will dispatch REMOVE_IN_VIEW for that item.
  //   TLDR; once an item is 80% inView and there are other elements in the viewport, we want the next item to be "active"
  //   More deets and inspo here: https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
  // */

  function calculate() {
    const scrollDirection =
      typeof window !== "undefined"
        ? () => {
            const newValue = window.pageYOffset;
            if (!window.oldValue) {
              window.oldValue = newValue;
            } else if (window.oldValue > newValue) {
              window.oldValue = newValue;
              return "up";
            } else if (window.oldValue < newValue) {
              window.oldValue = newValue;
              return "down";
            }
            window.oldValue = newValue;
            return undefined;
          }
        : undefined;
    const rect = ref?.current?.getBoundingClientRect();

    if (
      rect &&
      color &&
      state?.visibleElements?.length > 1 &&
      Math.abs(rect.top) > height * 0.5 &&
      state.visibleElements[0].color === color &&
      scrollDirection() === "down"
    ) {
      dispatch({
        type: actions.REMOVE_IN_VIEW,
        payload: {
          color
        }
      });
      document.removeEventListener("scroll", calculate);
    }
  }

  if (
    state?.visibleElements[0]?.color === color &&
    typeof window !== "undefined"
  ) {
    document.addEventListener("scroll", calculate);
    debugger;
  }

  return (
    <div
      style={{ height: height, backgroundColor: color, border: "15px" }}
      ref={setRefs}
    >
      {`${color}: ${inView}`}
    </div>
  );
};

const Menu = ({ menu }) => {
  const { state } = useInViewContext();
  return (
    <ul
      style={{
        background: "yellowgreen",
        padding: "5px",
        width: "130px",
        position: "fixed"
      }}
    >
      {Object.keys(menu).map((key) => {
        const { color, height, ref, status } = menu[key];
        return (
          <div
            style={{
              height: 100
            }}
          >
            <a
              href="#"
              style={{
                color: color,
                color:
                  state?.visibleElements[0]?.color === color ? "black" : color
              }}
              onClick={() => {
                ref.current.scrollIntoView();
              }}
            >{`${color}: ${height} - ${status}`}</a>
          </div>
        );
      })}
    </ul>
  );
};

const ACTIONS = {
  // there may be multiple elements visible in viewport, but we only want 1 "in view"
  SET_INITIAL_ELEMENTS: "setElements",
  SET_IN_VIEW: "setInView",
  SET_ITEM_REF: "setItemRef",
  REMOVE_IN_VIEW: "removeInView",
  REMOVE_FROM_VISIBLE_ELEMENTS: "removeFromVisibleElements"
};

const reducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_INITIAL_ELEMENTS: {
      const { colors, heights } = action.payload;
      return {
        ...state,
        colors,
        heights,
        menu: action.payload.colors.reduce((acc, color, idx) => {
          acc = {
            ...acc,
            [color]: {
              color,
              height: action.payload.heights[idx],
              status: "notInView"
            }
          };
          return acc;
        }, {})
      };
    }
    case ACTIONS.SET_IN_VIEW: {
      const { color, ref } = action.payload;
      return {
        ...state,
        menu: {
          ...state.menu,
          [color]: {
            ...state.menu[color],
            status: "inView"
          }
        },
        visibleElements: [...state.visibleElements, { color, ref }]
      };
    }
    case ACTIONS.SET_ITEM_REF: {
      const { color, ref } = action.payload;
      return {
        ...state,
        menu: {
          ...state.menu,
          [color]: {
            ...state.menu[color],
            ref
          }
        }
      };
    }
    case ACTIONS.REMOVE_IN_VIEW: {
      const { color } = action.payload;
      return {
        ...state,
        menu: {
          ...state.menu,
          [color]: {
            ...state.menu[color],
            status: "notInView"
          }
        },
        visibleElements: state.visibleElements.filter(
          (element) => element.color !== color
        )
      };
    }
    default:
      return state;
  }
};

const useInViewStore = (initialState) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const deriveMostInViewElement = React.useCallback((state) =>
    state && state.visibleElements
      ? state.visibleElements[0]
      : { color: null }[dispatch]
  );

  const selectors = React.useMemo(() => {
    return {
      deriveMostInViewElement
    };
  }, [dispatch]);

  return {
    actions: ACTIONS,
    dispatch,
    selectors,
    state: {
      ...state
    }
  };
};

const InViewContext = React.createContext();
const useInViewContext = () => React.useContext(InViewContext);

export default function App() {
  const { actions, dispatch, selectors = {}, state } = useInViewStore({
    menu: [],
    visibleElements: []
  });

  React.useEffect(() => {
    dispatch({
      type: actions.SET_INITIAL_ELEMENTS,
      payload: {
        colors: ["#3a86ff", "#8338ec", "#ff006e", "#fb5607", "#ffbe0b"],
        heights: [900, 900, 900, 900, 900]
      }
    });
  }, [dispatch]);

  return (
    <div className="App">
      <InViewContext.Provider value={{ actions, dispatch, selectors, state }}>
        <Menu menu={state.menu} />
        {Object.keys(state.menu).map((key, idx) => {
          const { color = "", height = 100 } = state.menu[key];
          return <Box color={color} height={height} idx={idx} />;
        })}
      </InViewContext.Provider>
    </div>
  );
}
