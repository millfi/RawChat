import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Message} from '../api/deepseek';
import {useColors} from '../hooks/useColors';

interface Props {
  message: Message;
}

export function MessageBubble({message}: Props) {
  const C = useColors();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={[styles.avatar, {backgroundColor: C.avatarBg}]}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          {
            backgroundColor: isUser
              ? C.userBubbleBg
              : C.assistantBubbleBg,
          },
        ]}>
        <Text
          style={[
            styles.text,
            {color: isUser ? C.userBubbleText : C.assistantBubbleText},
          ]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  rowUser: {justifyContent: 'flex-end'},
  rowAssistant: {justifyContent: 'flex-start'},
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  bubbleUser: {borderBottomRightRadius: 4},
  bubbleAssistant: {borderBottomLeftRadius: 4},
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});
