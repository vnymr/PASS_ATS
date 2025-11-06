import { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

export const dummyData = [
  "Remote React jobs $100k+",
  "Senior engineer healthcare",
  "Data analyst NYC",
  "Design jobs flexible hours",
  "Machine learning startups",
  "Product manager fintech",
  "Frontend developer remote",
  "Full-stack engineer",
  "DevOps engineer",
  "Software architect",
];

const examplePlaceholders = [
  "Find remote React roles $120k+",
  "Software engineer at Google",
  "Data scientist fintech NYC",
  "Senior backend Python, EU remote",
  "Frontend developer Next.js healthcare",
  "AI/ML engineer startups",
];

const GooeyFilter = () => {
  return (
    <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id="goo-effect">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -15"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
};

const SearchIcon = ({ isUnsupported }: { isUnsupported: boolean }) => {
  return (
    <motion.svg
      initial={{
        opacity: 0,
        scale: 0.8,
        x: -4,
        filter: isUnsupported ? "none" : "blur(5px)",
      }}
      animate={{
        opacity: 1,
        scale: 1,
        x: 0,
        filter: "blur(0px)",
      }}
      exit={{
        opacity: 0,
        scale: 0.8,
        x: -4,
        filter: isUnsupported ? "none" : "blur(5px)",
      }}
      transition={{
        delay: 0.1,
        duration: 1,
        type: "spring",
        bounce: 0.15,
      }}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </motion.svg>
  );
};

const LoadingIcon = () => {
  return (
    <svg
      className="animate-spin"
      style={{ width: '15px', height: '15px' }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-label="Loading"
      role="status"
    >
      <rect width="256" height="256" fill="none" />
      <line
        x1="128"
        y1="32"
        x2="128"
        y2="64"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="195.88"
        y1="60.12"
        x2="173.25"
        y2="82.75"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="224"
        y1="128"
        x2="192"
        y2="128"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="195.88"
        y1="195.88"
        x2="173.25"
        y2="173.25"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="128"
        y1="224"
        x2="128"
        y2="192"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="60.12"
        y1="195.88"
        x2="82.75"
        y2="173.25"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="32"
        y1="128"
        x2="64"
        y2="128"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="60.12"
        y1="60.12"
        x2="82.75"
        y2="82.75"
        fill="none"
        stroke="#999999"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
    </svg>
  );
};

const InfoIcon = ({ index }: { index: number }) => {
  return (
    <motion.svg
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.12 + 0.3 }}
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20.2832 19.9316"
      style={{ width: '12px', height: '12px', marginRight: '6px' }}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M7.49991 0.876892C3.84222 0.876892 0.877075 3.84204 0.877075 7.49972C0.877075 11.1574 3.84222 14.1226 7.49991 14.1226C11.1576 14.1226 14.1227 11.1574 14.1227 7.49972C14.1227 3.84204 11.1576 0.876892 7.49991 0.876892ZM1.82707 7.49972C1.82707 4.36671 4.36689 1.82689 7.49991 1.82689C10.6329 1.82689 13.1727 4.36671 13.1727 7.49972C13.1727 10.6327 10.6329 13.1726 7.49991 13.1726C4.36689 13.1726 1.82707 10.6327 1.82707 7.49972ZM8.24992 4.49999C8.24992 4.91420 7.91413 5.24999 7.49992 5.24999C7.08571 5.24999 6.74992 4.91420 6.74992 4.49999C6.74992 4.08577 7.08571 3.74999 7.49992 3.74999C7.91413 3.74999 8.24992 4.08577 8.24992 4.49999ZM6.00003 5.99999H6.50003H7.50003C7.77618 5.99999 8.00003 6.22384 8.00003 6.49999V9.99999H8.50003H9.00003V11H8.50003H7.50003H6.50003H6.00003V9.99999H6.50003H7.00003V6.99999H6.50003H6.00003V5.99999Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </motion.svg>
  );
};

const buttonVariants = {
  initial: { x: 0, width: 360 },
  step1: { x: 0, width: 360 },
  step2: { x: 0, width: 360 },
};

const iconVariants = {
  hidden: { x: -50, opacity: 0 },
  visible: { x: 12, opacity: 1 },
};

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const isUnsupportedBrowser = () => {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent.toLowerCase();

  const isSafari =
    ua.includes("safari") &&
    !ua.includes("chrome") &&
    !ua.includes("chromium") &&
    !ua.includes("android") &&
    !ua.includes("firefox");

  const isChromeOniOS = ua.includes("crios");

  return isSafari || isChromeOniOS;
};

const getResultItemVariants = (index: number, isUnsupported: boolean) => ({
  initial: {
    y: 0,
    x: 0,
    scale: 0.3,
    filter: isUnsupported ? "none" : "blur(10px)",
  },
  animate: {
    y: (index + 1) * 48,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: {
    y: isUnsupported ? 0 : -4,
    x: 0,
    scale: 0.8,
    color: "#000000",
  },
});

const getResultItemTransition = (index: number) => ({
  duration: 0.75,
  delay: index * 0.12,
  type: "spring" as const,
  bounce: 0.35,
  exit: { duration: index * 0.1 },
  filter: { ease: "easeInOut" },
});

interface GooeySearchBarProps {
  onSearch?: (query: string) => void;
  suggestions?: string[];
}

export const GooeySearchBar = ({ onSearch, suggestions = dummyData }: GooeySearchBarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState({
    step: 1,
    searchData: [] as string[],
    searchText: "",
    isLoading: false,
    placeholderText: "",
    placeholderIndex: 0,
    typingPhase: "typing" as "typing" | "pausing" | "deleting",
  });

  const debouncedSearchText = useDebounce(state.searchText, 500);
  const isUnsupported = useMemo(() => isUnsupportedBrowser(), []);

  const handleButtonClick = () => {
    setState((prevState) => ({ ...prevState, step: 2 }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prevState) => ({ ...prevState, searchText: e.target.value }));
  };

  const handleResultClick = (item: string) => {
    if (onSearch) {
      onSearch(item);
    }
    setState({
      step: 1,
      searchData: [],
      searchText: "",
      isLoading: false,
      placeholderText: "",
      placeholderIndex: 0,
      typingPhase: "typing",
    });
  };

  useEffect(() => {
    if (state.step === 2) {
      inputRef.current?.focus();
    } else {
      setState((prevState) => ({
        ...prevState,
        searchText: "",
        searchData: [],
        isLoading: false,
        placeholderText: "",
        placeholderIndex: 0,
        typingPhase: "typing",
      }));
    }
  }, [state.step]);

  // Typewriter animation for rotating placeholder examples
  useEffect(() => {
    const TYPING_INTERVAL_MS = 80;
    const DELETING_INTERVAL_MS = 40;
    const PAUSE_MS = 1200;

    if (state.step !== 2 || state.searchText.trim() !== "") {
      // Stop animation when not in typing step or user has started typing
      if (state.placeholderText !== "") {
        setState((prev) => ({ ...prev, placeholderText: "" }));
      }
      return;
    }

    const prompts = examplePlaceholders;
    const currentPrompt = prompts[state.placeholderIndex % prompts.length];

    let timeoutId: number | undefined;

    if (state.typingPhase === "typing") {
      if (state.placeholderText.length < currentPrompt.length) {
        timeoutId = window.setTimeout(() => {
          setState((prev) => ({
            ...prev,
            placeholderText: currentPrompt.slice(0, prev.placeholderText.length + 1),
          }));
        }, TYPING_INTERVAL_MS);
      } else {
        timeoutId = window.setTimeout(() => {
          setState((prev) => ({ ...prev, typingPhase: "deleting" }));
        }, PAUSE_MS);
      }
    } else if (state.typingPhase === "deleting") {
      if (state.placeholderText.length > 0) {
        timeoutId = window.setTimeout(() => {
          setState((prev) => ({
            ...prev,
            placeholderText: prev.placeholderText.slice(0, -1),
          }));
        }, DELETING_INTERVAL_MS);
      } else {
        setState((prev) => ({
          ...prev,
          typingPhase: "typing",
          placeholderIndex: prev.placeholderIndex + 1,
        }));
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [state.step, state.searchText, state.placeholderText, state.placeholderIndex, state.typingPhase]);

  useEffect(() => {
    let isCancelled = false;

    if (debouncedSearchText) {
      setState((prevState) => ({ ...prevState, isLoading: true }));

      const fetchData = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));

          const filteredData = suggestions.filter((item) =>
            item
              .toLowerCase()
              .includes(debouncedSearchText.trim().toLowerCase())
          );

          if (!isCancelled) {
            setState((prevState) => ({
              ...prevState,
              searchData: filteredData,
              isLoading: false,
            }));
          }
        } catch {
          if (!isCancelled) {
            setState((prevState) => ({ ...prevState, isLoading: false }));
          }
        }
      };

      fetchData();
    } else {
      setState((prevState) => ({
        ...prevState,
        searchData: [],
        isLoading: false,
      }));
    }

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearchText, suggestions]);

  return (
    <div
      className={clsx("relative flex items-center justify-start", isUnsupported && "no-goo")}
      style={{
        filter: isUnsupported ? 'none' : 'url(#goo-effect)',
      }}
    >
      <GooeyFilter />

      <div className="relative" style={{ minHeight: '56px', display: 'flex', alignItems: 'center' }}>
        <motion.div
          className="relative"
          initial="initial"
          animate={state.step === 1 ? "step1" : "step2"}
          transition={{ duration: 0.75, type: "spring", bounce: 0.15 }}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key="search-text-wrapper"
              className="absolute"
              style={{ top: '-60px', left: '0' }}
              role="listbox"
              aria-label="Search results"
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                delay: isUnsupported ? 0.5 : 1.25,
                duration: 0.5,
              }}
            >
              <AnimatePresence mode="popLayout">
                {state.searchData.map((item, index) => (
                  <motion.div
                    key={item}
                    onClick={() => handleResultClick(item)}
                    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                    variants={getResultItemVariants(index, isUnsupported)}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={getResultItemTransition(index)}
                    className="absolute cursor-pointer bg-white rounded-full px-4 py-2 shadow-md border border-gray-200 hover:border-primary transition-colors"
                    style={{
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                    role="option"
                  >
                    <div className="flex items-center">
                      <InfoIcon index={index} />
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.12 + 0.3 }}
                      >
                        {item}
                      </motion.span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {state.step === 2 && (
              <motion.div
                key="icon"
                className="absolute top-1/2 -translate-y-1/2"
                style={{ fill: 'white', left: '-28px' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  delay: 0.2,
                  duration: 0.3,
                }}
              >
                {!state.isLoading ? (
                  <SearchIcon isUnsupported={isUnsupported} />
                ) : (
                  <LoadingIcon />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            variants={buttonVariants}
            onClick={handleButtonClick}
            whileHover={{ scale: state.step === 2 ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative bg-primary text-white rounded-full h-14 flex items-center justify-center cursor-pointer shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            role="button"
            style={{ minWidth: '160px' }}
          >
            {state.step === 1 ? (
              <span className="font-medium text-base">Search Jobs</span>
            ) : (
              <input
                ref={inputRef}
                type="text"
                className="w-full h-full bg-transparent border-none outline-none text-white placeholder-white/70 px-5 text-base"
                placeholder={state.placeholderText || "Search jobs..."}
                aria-label="Search input"
                onChange={handleSearch}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && state.searchText.trim()) {
                    handleResultClick(state.searchText.trim());
                  }
                }}
              />
            )}
          </motion.div>

          {/* Inline dropdown suggestions under the search bar while typing */}
          <AnimatePresence>
            {state.step === 2 && (state.isLoading || (state.searchText.trim() && state.searchData.length > 0)) && (
              <motion.div
                key="dropdown-suggestions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="absolute left-0"
                style={{ top: 'calc(100% + 8px)', width: '360px', zIndex: 30 }}
                role="listbox"
                aria-label="Live search suggestions"
              >
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  {state.isLoading ? (
                    <div className="px-4 py-3 text-sm text-gray-600 flex items-center">
                      <span className="mr-2" aria-hidden>
                        <LoadingIcon />
                      </span>
                      Searching…
                    </div>
                  ) : (
                    state.searchData.slice(0, 8).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleResultClick(item)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                        role="option"
                        aria-selected={false}
                      >
                        {item}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
