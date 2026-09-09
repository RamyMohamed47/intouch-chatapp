import type { MessageMention } from "@intouch/shared/messages";
import { Text, type TextStyle } from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";

export const MessageText = ({
  content,
  mentions,
  style,
}: {
  content: string;
  mentions: MessageMention[];
  style?: TextStyle;
}) => {
  const { theme } = useAppearance();
  let cursor = 0;
  return (
    <Text style={[{ color: theme.text, fontSize: 16 }, style]}>
      {mentions.flatMap((mention, index) => {
        const before = content.slice(cursor, mention.start);
        const highlighted = content.slice(mention.start, mention.end);
        cursor = mention.end;
        return [
          before ? <Text key={`before-${index}`}>{before}</Text> : null,
          <Text
            key={`mention-${mention.userId}-${mention.start}`}
            style={{ color: theme.accent, fontWeight: "900" }}
          >
            {highlighted}
          </Text>,
        ];
      })}
      {content.slice(cursor)}
    </Text>
  );
};
