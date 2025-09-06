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

# Guidelines
- The template should be the main page, meaning that the editor should feel like an extension to the template and not the other way arround.
- Tthe editor and template should integrate together into a single html file so that I can host it and test it with serving only one html file
