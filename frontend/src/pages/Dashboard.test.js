import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom'; // <-- THE CRITICAL IMPORT
import { FilterDropdown } from './Dashboard.jsx';

// A "test suite" for our FilterDropdown component
describe('FilterDropdown Component', () => {

  // We create a helper function to wrap our component with the router.
  // This keeps our tests clean and avoids repetition.
  const renderWithRouter = (ui) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
  };

  // This is our table of test cases for efficient, reusable testing.
  const testCases = [
    [
      'Sort Dropdown', 
      { 
        name: 'sort', 
        value: 'date_desc', 
        options: [{ value: 'date_desc', label: 'Newest First' }, { value: 'date_asc', label: 'Oldest First' }] 
      }
    ],
    [
      'Status Dropdown', 
      { 
        name: 'status', 
        value: '', 
        options: [{ value: '', label: 'All Statuses' }, { value: 'suspicious', label: 'Suspicious' }] 
      }
    ],
    [
      'Read Status Dropdown', 
      { 
        name: 'isRead', 
        value: 'false', 
        options: [{ value: 'false', label: 'Unread' }, { value: 'true', label: 'Read' }] 
      }
    ]
  ];

  // This test runs for every row in our testCases table.
  it.each(testCases)('should render the %s correctly', (testName, props) => {
    // Use our new helper function to render the component inside a router.
    renderWithRouter(<FilterDropdown {...props} onChange={() => {}} />);
    
    // Assert that the first option in the dropdown exists.
    expect(screen.getByText(props.options[0].label)).toBeInTheDocument();
  });

  // This second test also runs for every row in the table.
  it.each(testCases)('should call onChange for the %s when a new value is selected', (testName, props) => {
    const mockOnChange = jest.fn();
    renderWithRouter(<FilterDropdown {...props} onChange={mockOnChange} />);

    const selectElement = screen.getByRole('combobox');
    
    // We simulate the user selecting the *second* option to test the change event.
    if (props.options[1]) {
      fireEvent.change(selectElement, { target: { value: props.options[1].value } });
      // We expect our mock function to have been called exactly once.
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    }
  });
});

