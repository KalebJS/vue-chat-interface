# State Management System

This directory contains the core state management system for the chat interface, built around the `StateManager` class and React hooks.

## Overview

The state management system provides:
- Centralized application state management
- Integration with LangChain for AI conversation handling
- localStorage persistence for conversation history
- Framework-native React hooks for component integration
- Type-safe state updates and subscriptions

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Hook    │───▶│   StateManager   │───▶│  LangChainService│
│ useStateManager │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   localStorage   │
                       │   Persistence    │
                       └──────────────────┘
```

## Core Components

### StateManager (`StateManager.ts`)

The central state management class that:
- Manages application state with type safety
- Provides subscription-based updates
- Handles localStorage persistence
- Synchronizes with LangChain service
- Offers debugging utilities

**Key Methods:**
- `setState(updates)` - Update state with partial changes
- `subscribe(callback)` - Listen for state changes
- `addMessage(message)` - Add new chat messages
- `loadConversationHistory()` - Load history from LangChain
- `persistState()` - Save state to localStorage

### React Hook (`useStateManager.ts`)

React integration providing:
- `useStateManager()` - Full state management access
- `useAppState()` - Read-only state access
- `useMessages()` - Messages array access
- `useAudioState()` - Audio state access
- `useLangChainState()` - LangChain state access
- `useAppSettings()` - Settings access

## Usage Examples

### Basic State Management

```typescript
import { useStateManager } from '../hooks/useStateManager';

function ChatComponent() {
  const { 
    state, 
    addMessage, 
    updateCurrentInput,
    sendMessage 
  } = useStateManager();

  const handleSendMessage = async () => {
    if (state?.currentInput.trim()) {
      await sendMessage(state.currentInput);
      updateCurrentInput('');
    }
  };

  return (
    <div>
      <div>Messages: {state?.messages.length}</div>
      <input 
        value={state?.currentInput || ''} 
        onChange={(e) => updateCurrentInput(e.target.value)}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}
```

### Specialized Hooks

```typescript
import { useMessages, useAudioState } from '../hooks/useStateManager';

function MessageList() {
  const messages = useMessages();
  
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.text}</div>
      ))}
    </div>
  );
}

function AudioControls() {
  const audioState = useAudioState();
  
  return (
    <div>
      Recording: {audioState.isRecording ? 'Yes' : 'No'}
    </div>
  );
}
```

### LangChain Integration

```typescript
const { 
  initializeLangChain, 
  sendMessage, 
  clearLangChainMemory 
} = useStateManager();

// Initialize AI service
await initializeLangChain();

// Send message to AI
await sendMessage('Hello, how are you?');

// Clear conversation history
await clearLangChainMemory();
```

## State Structure

```typescript
interface AppState {
  messages: Message[];           // Chat conversation
  currentInput: string;          // Current input text
  isLoading: boolean;           // Loading state
  audioState: AudioState;       // Audio recording state
  langChainState: LangChainState; // AI service state
  error?: string;               // Error messages
  settings: AppSettings;        // User preferences
}
```

## Persistence

The StateManager automatically persists:
- Chat messages
- User settings
- Conversation context (via LangChain)

**Storage Strategy:**
- `localStorage` for UI state and settings
- LangChain memory stores for conversation context
- Graceful fallback when storage is unavailable

## Error Handling

The system provides robust error handling:
- Graceful localStorage failures
- LangChain service error recovery
- Network connectivity issues
- Invalid state recovery

## Testing

Comprehensive test coverage includes:
- Unit tests for StateManager (`StateManager.test.ts`)
- React hook tests (`useStateManager.test.ts`)
- Integration tests with mocked services
- Error scenario testing
- Persistence testing

Run tests with:
```bash
npm test -- StateManager
```

## Performance Considerations

- **Subscription Management**: Automatic cleanup prevents memory leaks
- **Selective Updates**: Only changed state triggers re-renders
- **Lazy Loading**: Services initialize on demand
- **Debounced Persistence**: Reduces localStorage write frequency

## Debugging

Use the debug utilities:
```typescript
const { getDebugInfo } = useStateManager();
console.log(getDebugInfo());
```

This provides:
- State size metrics
- Subscriber count
- Service initialization status
- Persistence status
- Memory usage information

## Integration with Other Services

The StateManager integrates with:
- **LangChainService**: AI conversation handling
- **AudioController**: Voice input/output (future)
- **MessageController**: Message processing (future)

## Best Practices

1. **Use Specialized Hooks**: Prefer `useMessages()` over `useStateManager().state.messages`
2. **Handle Loading States**: Always check loading state before actions
3. **Error Boundaries**: Wrap components with error boundaries
4. **Cleanup**: Hooks automatically handle cleanup, but manual cleanup is available
5. **Type Safety**: Use TypeScript interfaces for all state updates

## Future Enhancements

Planned improvements:
- State time-travel debugging
- Optimistic updates for better UX
- State persistence encryption
- Cross-tab synchronization
- Performance monitoring integration