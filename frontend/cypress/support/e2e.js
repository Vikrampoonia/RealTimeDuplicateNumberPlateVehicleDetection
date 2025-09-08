// This describes a suite of tests for the Dashboard user flow.
describe('Dashboard End-to-End Flow', () => {

  // This runs before each test. It sets up our "secret shopper".
  beforeEach(() => {
    // This is the most important command.
    // It tells Cypress: "Watch for any GET request to '/api/vehicles...'.
    // When you see one, don't let it go to the real backend. Instead,
    // intercept it and reply with the data from our 'vehicles.json' file."
    // We also give this intercept a name: 'getVehicles'.
    cy.intercept('GET', '/api/vehicles*', { fixture: 'vehicles.json' }).as('getVehicles');
  });

  // This is our main test case.
  it('should load the dashboard, allow filtering, and navigate to a details page', () => {
    
    // ARRANGE: Visit the application's homepage.
    cy.visit('http://localhost:3000');
    
    // ACT & ASSERT: Wait for our intercepted API call to happen, then check the title.
    cy.wait('@getVehicles');
    cy.contains('h1', 'Suspicious Vehicle Dashboard').should('be.visible');

    // ACT & ASSERT: Find the search input, type into it, and verify a new API call is made.
    cy.get('input[placeholder="Search by plate..."]').type('MH12');
    cy.wait('@getVehicles').its('request.url').should('include', 'search=MH12');

    // ACT & ASSERT: Find the "Status" filter, change its value, and verify a new API call.
    cy.get('select[name="status"]').select('suspicious');
    cy.wait('@getVehicles').its('request.url').should('include', 'status=suspicious');

    // ACT: Find the first vehicle in the list (which is a link) and click it.
    cy.get('.space-y-4 > a').first().click();

    // ASSERT: Verify that the URL has changed and we are on the details page.
    cy.url().should('include', '/vehicle/');
    cy.contains('h2', 'Alert Details').should('be.visible');
  });
});
