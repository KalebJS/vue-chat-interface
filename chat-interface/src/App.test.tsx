import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    // The app should render either the loading state or the chat interface
    expect(
      screen.getByText(/Initializing AI model/i) || 
      screen.getByText(/AI Chat Interface/i)
    ).toBeInTheDocument()
  })
})