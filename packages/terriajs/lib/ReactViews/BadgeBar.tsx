import { ReactNode, FC, useEffect, useRef, useState } from "react";
import { useTheme } from "styled-components";
import { TextSpan } from "../Styled/Text";
import Box from "../Styled/Box";

interface IProps {
  label: string;
  badge?: number;
  children: ReactNode;
}
const BadgeBar: FC<IProps> = (props: IProps) => {
  const theme = useTheme();
  const rowRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let labelsWidth = 0;
    let isCompact = false;
    const observer = new ResizeObserver(() => {
      if (!isCompact) labelsWidth = row.scrollWidth;
      isCompact = row.clientWidth < labelsWidth;
      setCompact(isCompact);
    });
    [row, ...Array.from(row.children)].forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      flex
      column
      styledMargin="0 15px"
      justifySpaceBetween
      whiteSpace="nowrap"
      styledMinHeight="70px"
      verticalCenter
      css={`
        border-top: 1px solid ${theme.darkLighter};
        border-bottom: 1px solid ${theme.darkLighter};
        justify-content: space-evenly;
        align-items: center;
      `}
    >
      <Box>
        <TextSpan textLight uppercase overflowHide overflowEllipsis>
          {props.label} {props.badge !== undefined ? `(${props.badge})` : null}
        </TextSpan>
      </Box>
      <Box
        ref={rowRef}
        flex
        styledWidth="100%"
        css={`
          justify-content: space-between;
          ${compact ? `${TextSpan} { display: none; }` : ""}
        `}
      >
        {props.children}
      </Box>
    </Box>
  );
};

export default BadgeBar;
