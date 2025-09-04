# Description

I want to create a way for users to edit templates.
What I mean by this is there should be a page that receives a template and displays it. On mouse hover the different parts of the template meaning text, titles, images, buttons should be highlighted so that it seems to the user that he can click them to edit.
On clicking it should let the user change the text that will be displayed there and actually update the html that is being displayed at the moment.
Or if an image is clicked it should let the user change the image to the one he uploads.

# Restrictions
- No libraries should be used to achieve this. (if you think a library can achieve what we want suggest it so I can research it)
- The input will be the template html file. Each of the components that can be changed by the user has one of the following:
    - data-text-id="<id>" for texts
    - data-image-src="<id>" data-alt-text-id="<id>"
- For data-text-id it should create/update an json file called <lang>.json that will be used to generate translations and generate the static .html in the backend
    - p.e. : {
                "title": "This is the title"
             }

# Implementation Status

## What is Implemented

- **Editor Page**: Created `editor.html` that loads templates via dropdown selection
- **Hover Highlighting**: Elements with `data-text-id` or `data-image-src` get blue outlines on hover
- **Click-to-Edit**:
  - Text elements show input fields for editing
  - Images show file pickers for replacement
- **JSON Generation**: Real-time updates to display `en.json` (for texts/alts) and `images.json` (for image paths)
- **Export**: Button to download changes as JSON file
- **Responsive Design**: Added mobile-friendly CSS

## What Needs to Be Implemented

- **Backend Integration**: Server-side code to actually create/update JSON files
- **Multiple Language Support**: Handle multiple languages, not just `en.json`
- **Real File Uploads**: Upload images to server and store paths
- **Input Validation/Security**: Sanitize user inputs and file types
- **Persistence**: Save changes across sessions
- **Advanced Features**: Undo/redo, bulk editing, template saving

## How to Test

1. Open `editor.html` in a web browser (e.g., via `npm run dev` or directly)
2. Select a template from the dropdown (Business Card or Modern Header)
3. Click "Load Template" to display it
4. Hover over text/images to see highlights
5. Click elements to edit: texts get input fields, images get file pickers
6. Watch the JSON update in real-time at the bottom
7. Click "Export JSON" to download the changes file

The editor works entirely client-side with vanilla JavaScript, no libraries as requested. For full functionality, a backend would be needed to persist changes.

