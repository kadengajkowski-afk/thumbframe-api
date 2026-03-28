import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ThumbFrame logo text', () => {
  render(<App />);
  const logoElements = screen.getAllByText(/ThumbFrame/i);
  expect(logoElements.length).toBeGreaterThan(0);
});
