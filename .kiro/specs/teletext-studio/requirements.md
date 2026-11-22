# Requirements Document

## Introduction

Teletext Studio is a client-side web application that resurrects 1980s broadcast teletext (BBC Ceefax / ITV ORACLE) as a creative tool. It is a page designer for 40-column by 24-row teletext pages using the authentic 8-colour teletext palette, mosaic/block graphics built from sextant cells, flashing text mode, and hold/reveal (conceal) mode. Pages are linked by 3-digit page numbers in the range 100 to 899 and browsed like a real teletext set with Fastext-style coloured navigation links.

The application runs entirely in the browser, is written in plain HTML, CSS, and JavaScript with no build step, and requires no backend, no user accounts, and no external services or AI APIs. It is statically hostable at zero cost on any static host (including GitHub Pages). It is mobile-friendly with touch support, presents an English user interface by default with an RTL/Arabic toggle, and exports work as a PNG render of a single page or as a shareable URL that encodes the whole page set.

## Glossary

### Domain Terms

- **Teletext**: The 1970s-1980s broadcast text and simple graphics information service, transmitted alongside television signals and displayed on a fixed character grid with a limited colour palette.
- **Ceefax**: The BBC's teletext service (1974-2012).
- **ORACLE**: The ITV/ITN teletext service (1974-1992).
- **Mosaic Graphics (Block Graphics)**: A teletext graphics mode in which each character cell is divided into sub-cells that can be individually filled, producing blocky pixel-art rather than text glyphs.
- **Sextant Cell**: One of six sub-cells within a single character Cell, arranged as 2 columns by 3 rows. Each Sextant Cell can be filled or empty, giving 64 possible mosaic glyphs per Cell (2^6).
- **Fastext**: The teletext navigation feature in which four coloured links (red, green, yellow, cyan) at the bottom of a page each jump to another page.
- **Hold/Reveal (Conceal)**: The teletext feature in which marked text is hidden from the viewer until the viewer presses a "reveal" action, classically used for quiz answers.
- **Flashing Mode**: A teletext text attribute in which the affected text blinks on and off at the broadcast cadence.

### Colour Terms

- **Teletext_Palette**: The authentic 8-colour teletext palette: black (#000000), red (#FF0000), green (#00FF00), yellow (#FFFF00), blue (#0000FF), magenta (#FF00FF), cyan (#00FFFF), and white (#FFFFFF).
- **Foreground_Colour**: The Teletext_Palette colour applied to the drawn content (text glyph or filled Sextant Cell) of a Cell.
- **Background_Colour**: The Teletext_Palette colour applied to the empty area of a Cell.

### Data Model Terms

- **Page**: A single teletext page composed of a grid of 40 columns by 24 rows of Cells, plus four Fastext link targets.
- **Cell**: A single character position on a Page, carrying a glyph (or mosaic pattern), a Foreground_Colour, a Background_Colour, and the Flashing_Mode and Conceal_Mode attribute flags, plus a text/mosaic mode flag.
- **Page_Set**: The collection of all Pages in a Teletext Studio project, keyed by Page_Number.
- **Page_Number**: A 3-digit number in the range 100 to 899 that uniquely identifies a Page within a Page_Set.

### Component Terms

- **Teletext_Studio**: The complete application described by this document.
- **Editor**: The subsystem that lets a designer create and modify Pages, Cells, colour attributes, mosaic patterns, and Fastext links.
- **Mosaic_Editor**: The subsystem of the Editor that handles drawing Sextant Cells for mosaic/block graphics.
- **Renderer**: The subsystem that renders a Page to a visual representation (on screen and for PNG export), applying colours, Flashing_Mode, and Conceal_Mode.
- **Navigator**: The subsystem that lets a viewer browse a Page_Set by Page_Number and via Fastext links.
- **Exporter**: The subsystem that renders a Page to a downloadable PNG image.
- **URL_Encoder**: The subsystem that serialises an entire Page_Set into a shareable URL.
- **URL_Decoder**: The subsystem that deserialises a shareable URL back into a Page_Set.
- **UI**: The user interface of Teletext_Studio, including controls, toolbars, the page canvas, and the language/direction toggle.
- **Fastext_Link**: One of the four coloured navigation keys (red, green, yellow, cyan) displayed by the Navigator, each pointing to a target Page_Number.

## Requirements

### Requirement 1: Teletext Page Grid

**User Story:** As a designer, I want to edit a teletext page on a 40-column by 24-row character grid, so that my pages match the authentic broadcast teletext format.

#### Acceptance Criteria

1. THE Editor SHALL display a grid of 40 columns by 24 rows of Cells per Page.
2. WHEN a designer selects a Cell, THE Editor SHALL place a cursor at that Cell position.
3. WHEN a character is entered and a Cell is selected, THE Editor SHALL write the entered character to that selected Cell.
4. WHEN a designer requests deletion and a Cell is selected, THE Editor SHALL clear the selected Cell to a space character.
5. THE Editor SHALL maintain exactly 40 columns by 24 rows of Cells at every viewport size, without adding, removing, or merging Cells.
6. WHEN a character is written to a selected Cell, THE Editor SHALL advance the cursor to the next Cell in left-to-right, top-to-bottom order, wrapping from the last Cell of a row to the first Cell of the next row and from the last Cell of the Page to the first Cell of the Page.
7. IF a character is entered while no Cell is selected, THEN THE Editor SHALL make no change to the Page.
8. IF a designer requests deletion while no Cell is selected, THEN THE Editor SHALL make no change to the Page.

### Requirement 2: Colour Control

**User Story:** As a designer, I want to set foreground and background colours using the authentic 8-colour teletext palette, so that my pages have the classic teletext look.

#### Acceptance Criteria

1. THE Editor SHALL offer the Teletext_Palette of exactly eight colours: black, red, green, yellow, blue, magenta, cyan, and white.
2. THE Editor SHALL initialise every Cell with a default Foreground_Colour of white and a default Background_Colour of black, both drawn from the Teletext_Palette.
3. WHEN a designer selects a Foreground_Colour from the Teletext_Palette, THE Editor SHALL use that colour as the Foreground_Colour for every character entered after the selection, until a different Foreground_Colour is selected.
4. WHEN a designer selects a Background_Colour from the Teletext_Palette, THE Editor SHALL use that colour as the Background_Colour for every character entered after the selection, until a different Background_Colour is selected.
5. WHILE a region of one or more Cells is selected, WHEN a designer selects a Foreground_Colour from the Teletext_Palette, THE Editor SHALL apply that colour as the Foreground_Colour of every Cell in the region.
6. WHILE a region of one or more Cells is selected, WHEN a designer selects a Background_Colour from the Teletext_Palette, THE Editor SHALL apply that colour as the Background_Colour of every Cell in the region.
7. THE Renderer SHALL render each Cell using its assigned Foreground_Colour and Background_Colour.

### Requirement 3: Mosaic / Block Graphics

**User Story:** As a designer, I want to draw blocky pixel-art mosaics using sextant cells, so that I can create graphics that look like authentic teletext block graphics.

#### Acceptance Criteria

1. WHERE mosaic graphics mode is active, THE Mosaic_Editor SHALL divide each character Cell into six Sextant Cells arranged as 2 columns by 3 rows.
2. WHEN a designer toggles a Sextant Cell, THE Mosaic_Editor SHALL invert that Sextant Cell's state, filling it if empty and clearing it if filled.
3. THE Renderer SHALL render each filled Sextant Cell in the Cell's Foreground_Colour and each empty Sextant Cell in the Cell's Background_Colour.
4. WHEN a designer switches a Cell between text mode and mosaic mode, THE Editor SHALL preserve the Foreground_Colour and Background_Colour of that Cell.
5. THE Mosaic_Editor SHALL accept Sextant Cell input from both pointer and touch devices.
6. WHEN a Cell enters mosaic mode, THE Mosaic_Editor SHALL initialize all six Sextant Cells of that Cell to empty.

### Requirement 4: Flashing Text Mode

**User Story:** As a designer, I want to mark text as flashing, so that it blinks on and off at the broadcast teletext cadence.

#### Acceptance Criteria

1. WHERE Flashing_Mode is applied to a Cell, THE Renderer SHALL blink that Cell's content on and off, displaying the Cell's content when visible and a blank Background_Colour space when hidden.
2. WHILE Flashing_Mode is active, THE Renderer SHALL toggle the visibility of all flashing Cells synchronously at a cadence of one on/off cycle per second, with 0.5 seconds visible and 0.5 seconds hidden.
3. WHEN a designer applies Flashing_Mode, THE Editor SHALL mark the selected Cells as flashing.
4. WHEN a designer removes Flashing_Mode, THE Editor SHALL mark the selected Cells as non-flashing.

### Requirement 5: Hold / Reveal (Conceal) Mode

**User Story:** As a designer, I want to mark text as concealed, so that viewers must press reveal to see it, just like classic teletext quizzes.

#### Acceptance Criteria

1. WHERE Conceal_Mode is applied to a Cell, THE Renderer SHALL hide that Cell's content on initial render of the Page.
2. WHILE a reveal action has not been requested for the currently displayed Page, THE Renderer SHALL display that Page's concealed Cells as blank Background_Colour space.
3. WHEN a viewer requests reveal, THE Renderer SHALL display the hidden content of every concealed Cell on the currently displayed Page.
4. WHEN a viewer requests hide, THE Renderer SHALL conceal the content of every concealed Cell on the currently displayed Page again.
5. THE Editor SHALL allow a designer to toggle Conceal_Mode on selected Cells.

### Requirement 6: Page Set Management

**User Story:** As a designer, I want to create and manage a set of pages identified by 3-digit page numbers, so that I can build a browsable teletext magazine.

#### Acceptance Criteria

1. THE Page_Set SHALL store Pages keyed by Page_Number in the range 100 to 899.
2. WHEN a designer creates a new Page, THE Editor SHALL assign it a unique Page_Number within the range 100 to 899.
3. IF a designer enters a Page_Number outside the range 100 to 899, THEN THE Editor SHALL reject the entry, display an error message indicating the Page_Number is out of range, and leave the existing Page_Set content unchanged.
4. WHEN a designer deletes a Page, THE Editor SHALL remove that Page from the Page_Set.
5. WHEN a designer changes a Page's Page_Number to an unused Page_Number within the range 100 to 899, THE Editor SHALL store that Page under the new Page_Number in the Page_Set while preserving that Page's Cells, Foreground_Colour, Background_Colour, Flashing_Mode, Conceal_Mode, and Fastext link targets.
6. IF a designer attempts to assign a Page_Number that is already used by another Page in the Page_Set, THEN THE Editor SHALL reject the change, display an error message indicating the Page_Number is already in use, and leave the existing Page_Set content unchanged.
7. IF a designer requests a new Page and every Page_Number in the range 100 to 899 is already assigned, THEN THE Editor SHALL display an error message indicating no Page_Number is available and SHALL NOT create a new Page.

### Requirement 7: Page Navigation and Fastext Links

**User Story:** As a viewer, I want to browse pages by number and via Fastext coloured links, so that I can navigate a teletext set like a real teletext service.

#### Acceptance Criteria

1. WHEN a viewer enters a Page_Number that exists in the Page_Set, THE Navigator SHALL display the corresponding Page.
2. WHILE a Page is displayed, THE Navigator SHALL display four Fastext_Links rendered as coloured keys in red, green, yellow, and cyan.
3. WHEN a viewer activates a Fastext_Link, THE Navigator SHALL navigate to the Page_Number targeted by that Fastext_Link.
4. WHILE a designer edits a Page, THE Editor SHALL allow the designer to assign a target Page_Number to each of the four Fastext_Links on that Page.
5. IF a viewer activates a Fastext_Link whose target Page_Number does not exist in the Page_Set, THEN THE Navigator SHALL display a page-not-found indicator and remain on the currently displayed Page.
6. IF a viewer enters a Page_Number that does not exist in the Page_Set, THEN THE Navigator SHALL display a page-not-found indicator and remain on the currently displayed Page.

### Requirement 8: PNG Export

**User Story:** As a designer, I want to export a rendered page as a PNG image, so that I can share or publish a static image of my teletext page.

#### Acceptance Criteria

1. WHEN a designer requests PNG export, THE Exporter SHALL render the current Page to a PNG image file and provide the resulting PNG image to the designer.
2. THE Exporter SHALL render each Cell of the Page as a 12-pixel-wide by 10-pixel-tall area, producing a PNG image of exactly 480 pixels wide by 240 pixels tall, using the assigned Foreground_Colour and Background_Colour of each Cell.
3. WHERE Flashing_Mode is active on Cells, THE Exporter SHALL render those Cells in their flash-on visible state, with the Cell's character content shown in its assigned Foreground_Colour against its Background_Colour.
4. WHERE Conceal_Mode is active on Cells, THE Exporter SHALL render those Cells with their character content shown in the assigned Foreground_Colour, matching the appearance of a non-concealed Cell.
5. IF the PNG export cannot be completed, THEN THE Exporter SHALL notify the designer with an error message indicating that the export failed and shall leave the current Page unchanged.

### Requirement 9: Shareable URL Export and Import

**User Story:** As a designer, I want to share my entire page set via a URL, so that others can open and view the whole set without a backend or account.

#### Acceptance Criteria

1. WHEN a designer requests a shareable URL, THE URL_Encoder SHALL encode the entire Page_Set into a single shareable URL of no more than 30000 characters.
2. THE URL_Encoder SHALL encode the Page_Set using a lossless, URL-safe representation.
3. WHEN a viewer opens a shareable URL, THE URL_Decoder SHALL reconstruct the encoded Page_Set.
4. WHEN a shareable URL generated from a Page_Set is opened, THE URL_Decoder SHALL reconstruct a Page_Set identical to the original Page_Set, preserving every page and all of its content.
5. IF a shareable URL cannot be decoded because it was not produced by the URL_Encoder or its encoded content has been altered, THEN THE URL_Decoder SHALL display an error indicating the URL is invalid and load an empty Page_Set.
6. THE URL_Encoder SHALL apply a lossless compression algorithm to the encoded Page_Set before producing the shareable URL.
7. THE URL_Encoder SHALL encode a single Page into a shareable URL of no more than 4000 characters.
8. IF a Page_Set cannot be encoded into a shareable URL within the 30000-character limit, THEN THE URL_Encoder SHALL display an error indicating the Page_Set is too large to share and SHALL NOT produce a shareable URL.

### Requirement 10: Client-Side Architecture and Static Hosting

**User Story:** As an operator, I want the app to run entirely client-side with no build step and no external services, so that I can host it for free on any static host.

#### Acceptance Criteria

1. THE Teletext_Studio SHALL run in the browser without requiring server-side processing or a backend service.
2. THE Teletext_Studio SHALL consist of HTML, CSS, and JavaScript files that execute directly in a browser without requiring a build or preprocessing step.
3. THE Teletext_Studio SHALL provide all features without requiring user registration, login, or authentication.
4. THE Teletext_Studio SHALL operate without making runtime network requests to third-party services or AI APIs.
5. WHERE the Teletext_Studio is deployed to a static host that serves files without server-side processing, THE Teletext_Studio SHALL operate all interactive features using only static file delivery.
6. WHEN no network connection is available after the initial page load, THE Teletext_Studio SHALL continue to operate all features.

### Requirement 11: Mobile and Touch Support

**User Story:** As a mobile user, I want to design and navigate teletext pages using touch, so that I can use Teletext Studio on a phone or tablet.

#### Acceptance Criteria

1. WHEN a user taps a Cell via touch input, THE Editor SHALL select that Cell.
2. WHILE a touch-screen device is in use, THE UI SHALL present each interactive control outside the page canvas with a touch target of at least 44 by 44 CSS pixels.
3. WHEN a viewer taps a Fastext_Link via touch input, THE Navigator SHALL navigate to the Page_Number targeted by that Fastext_Link.
4. WHILE the viewport width is less than 768 CSS pixels, THE UI SHALL present all controls and the page canvas without requiring horizontal scrolling.
5. WHILE no physical keyboard is available, THE UI SHALL allow a user to select Cells, enter characters, toggle Sextant Cells, and set Foreground_Colour and Background_Colour using only touch input.

### Requirement 12: UI Language and RTL / Arabic Support

**User Story:** As an Arabic-speaking user, I want to switch the UI and text direction to right-to-left Arabic, so that I can design teletext pages in Arabic.

#### Acceptance Criteria

1. THE UI SHALL default to English labels with left-to-right text direction.
2. WHERE the Arabic toggle is enabled, THE UI SHALL switch to Arabic labels and right-to-left layout.
3. WHERE the Arabic toggle is enabled, THE Editor SHALL accept Arabic character entry and render entered Arabic text within Cells using right-to-left text direction.
4. WHEN the Arabic toggle is switched, THE UI SHALL apply and maintain the newly selected language and direction while preserving existing Page content unchanged.
5. THE UI SHALL provide a visible control to toggle between English with left-to-right and Arabic with right-to-left.
