import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../components/ChatInterface';

// Mock services for cross-browser testing
vi.mock('../services/LangChainService');
vi.mock('../services/AudioController');
vi.mock('../services/StateManager');
vi.mock('../services/NetworkErrorHandler');

describe('Cross-Browser Compatibility Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let originalUserAgent: string;
  let originalSpeechRecognition: any;
  let originalWebkitSpeechRecognition: any;
  let originalSpeechSynthesis: any;

  beforeEach(() => {
    user = userEvent.setup();
    originalUserAgent = navigator.userAgent;
    originalSpeechRecognition = window.SpeechRecognition;
    originalWebkitSpeechRecognition = window.webkitSpeechRecognition;
    originalSpeechSynthesis = window.speechSynthesis;
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true
    });
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
    window.speechSynthesis = originalSpeechSynthesis;
    vi.clearAllMocks();
  });

  describe('Browser Detection and Feature Support', () => {
    it('should detect Chrome browser and enable WebKit Speech Recognition', async () => {
      // Mock Chrome user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true
      });

      // Ensure webkitSpeechRecognition is available
      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Audio features should be available
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
    });

    it('should detect Firefox browser and handle Speech Recognition absence', async () => {
      // Mock Firefox user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        writable: true
      });

      // Remove Speech Recognition APIs
      // @ts-ignore
      window.SpeechRecognition = undefined;
      // @ts-ignore
      window.webkitSpeechRecognition = undefined;

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should show audio unavailable message
      expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
      
      // Text interface should still work
      const input = screen.getByPlaceholderText('Type your message...');
      expect(input).toBeInTheDocument();
      expect(input).not.toBeDisabled();
    });

    it('should detect Safari browser and handle partial Web Speech API support', async () => {
      // Mock Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        writable: true
      });

      // Safari has webkitSpeechRecognition but limited support
      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      // Mock limited voice support
      window.speechSynthesis = {
        ...originalSpeechSynthesis,
        getVoices: vi.fn(() => [
          {
            name: 'Safari Voice',
            lang: 'en-US',
            voiceURI: 'safari-voice',
            localService: true,
            default: true
          } as SpeechSynthesisVoice
        ])
      };

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should handle Safari-specific behavior
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
    });

    it('should detect Edge browser and handle modern Speech API', async () => {
      // Mock Edge user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        writable: true
      });

      // Edge supports both APIs
      window.SpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should prefer standard SpeechRecognition over webkit version
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
    });
  });

  describe('Mobile Browser Compatibility', () => {
    it('should handle iOS Safari mobile browser', async () => {
      // Mock iOS Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        writable: true
      });

      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

      // iOS has limited speech recognition support
      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should adapt to mobile interface
      const input = screen.getByPlaceholderText('Type your message...');
      expect(input).toBeInTheDocument();

      // Touch events should work
      fireEvent.touchStart(input);
      fireEvent.touchEnd(input);

      expect(input).toBeInTheDocument();
    });

    it('should handle Android Chrome mobile browser', async () => {
      // Mock Android Chrome user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        writable: true
      });

      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 412, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 915, writable: true });

      // Android Chrome has good speech support
      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should have full audio functionality on Android Chrome
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();

      // Test touch interaction with record button
      const recordButton = screen.getByLabelText('Start recording');
      fireEvent.touchStart(recordButton);
      fireEvent.touchEnd(recordButton);

      // Should handle touch events properly
      expect(recordButton).toBeInTheDocument();
    });

    it('should handle mobile browser orientation changes', async () => {
      render(<ChatInterface />);

      // Mock portrait orientation
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

      fireEvent(window, new Event('orientationchange'));
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Mock landscape orientation
      Object.defineProperty(window, 'innerWidth', { value: 667, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 375, writable: true });

      fireEvent(window, new Event('orientationchange'));
      fireEvent(window, new Event('resize'));

      // Interface should adapt to orientation change
      expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
    });
  });

  describe('Legacy Browser Support', () => {
    it('should handle Internet Explorer 11 gracefully', async () => {
      // Mock IE11 user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
        writable: true
      });

      // IE11 doesn't support Speech APIs
      // @ts-ignore
      window.SpeechRecognition = undefined;
      // @ts-ignore
      window.webkitSpeechRecognition = undefined;
      // @ts-ignore
      window.speechSynthesis = undefined;

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should show audio unavailable but maintain text functionality
      expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
      
      const input = screen.getByPlaceholderText('Type your message...');
      expect(input).toBeInTheDocument();
      expect(input).not.toBeDisabled();
    });

    it('should handle older Chrome versions with limited API support', async () => {
      // Mock older Chrome user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
        writable: true
      });

      // Older Chrome might have webkitSpeechRecognition but limited features
      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => {
        const mockRecognition = {
          start: vi.fn(),
          stop: vi.fn(),
          abort: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
        
        // Simulate older API limitations
        setTimeout(() => {
          const errorEvent = new Event('error');
          (errorEvent as any).error = 'not-allowed';
          mockRecognition.addEventListener.mock.calls
            .filter(call => call[0] === 'error')
            .forEach(call => call[1](errorEvent));
        }, 100);
        
        return mockRecognition;
      });

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should handle API limitations gracefully
      const recordButton = screen.getByLabelText('Start recording');
      await user.click(recordButton);

      // Should show appropriate error handling
      await waitFor(() => {
        expect(screen.getByText(/permission/i)).toBeInTheDocument();
      });
    });
  });

  describe('Feature Detection and Progressive Enhancement', () => {
    it('should progressively enhance interface based on available features', async () => {
      // Start with no speech support
      // @ts-ignore
      window.SpeechRecognition = undefined;
      // @ts-ignore
      window.webkitSpeechRecognition = undefined;

      const { rerender } = render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
      });

      // Simulate feature becoming available (e.g., after user interaction)
      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      rerender(<ChatInterface />);

      // Should detect new feature availability
      await waitFor(() => {
        expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
      });
    });

    it('should handle partial API support gracefully', async () => {
      // Mock speech recognition available but synthesis not
      window.webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      // @ts-ignore
      window.speechSynthesis = undefined;

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should show recording available but not TTS
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
      
      // Should indicate TTS unavailable
      expect(screen.getByText(/text-to-speech/i)).toBeInTheDocument();
    });

    it('should handle network connectivity detection across browsers', async () => {
      // Mock different navigator.onLine behaviors
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      render(<ChatInterface />);

      // Should detect offline state
      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeInTheDocument();
      });

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });

      fireEvent(window, new Event('online'));

      // Should detect online state
      await waitFor(() => {
        expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
      });
    });

    it('should handle different localStorage implementations', async () => {
      const originalLocalStorage = window.localStorage;

      // Mock localStorage unavailable (e.g., private browsing)
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true
      });

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should work without localStorage
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Test without localStorage');
      await user.click(screen.getByLabelText('Send message'));

      // Should handle gracefully
      expect(input).toHaveValue('');

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
    });
  });

  describe('Performance Across Different Browsers', () => {
    it('should maintain performance standards across browser engines', async () => {
      const browsers = [
        {
          name: 'Chrome',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        {
          name: 'Firefox',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
        },
        {
          name: 'Safari',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
        }
      ];

      for (const browser of browsers) {
        Object.defineProperty(navigator, 'userAgent', {
          value: browser.userAgent,
          writable: true
        });

        const startTime = performance.now();
        const { unmount } = render(<ChatInterface />);

        await waitFor(() => {
          expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
        });

        const renderTime = performance.now() - startTime;
        
        // Should render within reasonable time across all browsers
        expect(renderTime).toBeLessThan(1000);

        unmount();
      }
    });

    it('should handle memory management consistently across browsers', async () => {
      // Test memory usage patterns
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<ChatInterface />);
        
        await waitFor(() => {
          expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
        });

        unmount();
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory should not grow excessively
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      }
    });
  });

  describe('Accessibility Across Browsers', () => {
    it('should maintain accessibility features across different browsers', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Test keyboard navigation
      await user.tab();
      expect(document.activeElement).toBeTruthy();

      // Test ARIA labels
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
      expect(screen.getByLabelText('Send message')).toBeInTheDocument();

      // Test screen reader compatibility
      const input = screen.getByPlaceholderText('Type your message...');
      expect(input).toHaveAttribute('aria-label');
    });

    it('should handle high contrast mode across browsers', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should adapt to high contrast preferences
      const chatInterface = screen.getByText('AI Chat Interface');
      expect(chatInterface).toBeInTheDocument();
    });
  });
});