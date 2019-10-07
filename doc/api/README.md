# API Documentation
This folder include the API documentation as well as some [open source tools](https://swagger.io/tools/open-source/) to:

##  View / Edit the documentation

The documentation follows the [Open API Specification (OAS) 3.0](https://swagger.io/specification/).
Optionally there is a [dedicated editor](https://swagger.io/tools/swagger-editor/) that can help a lot generating the code. There is a few options to use the editor:

- Using docker:
0. Install Docker (if you don't have it already)
1. `docker pull swaggerapi/swagger-editor`
2. `docker run --rm --name swagger-editor -d -p 80:8080 swaggerapi/swagger-editor`
3. Use your browser: http://localhost:80
4. Import the file: File/Import file => (path to the repo)/doc/api/operator-api.yaml
5. Save changes: File/Save as YAML => Move the file from your Downloads directory to the path of the repo and replace the old version. ***NOTE: Docker will keep changes made to browser sessions, even if the container is restarted, however the only way to persist changes is to export the file as described in this point.***
6. To stop the server: `docker kill swagger-editor`

- Run locally *Not tested*:
0. Install Node 6.x and NPM 3.x (if you don't have it already)
1. Clone the [repo](https://github.com/swagger-api/swagger-editor)
2. Run `npm start`

- Use a hosted solution like [swagger hub](https://swagger.io/tools/swaggerhub/) *Not tested*

***More info about swagger-editor on the*** [GitHub repo](https://github.com/swagger-api/swagger-editor)

## View the documentation

If you don't want to edit the docs, but just have a nice frontend to read it, you can do it by:

- Using docker:
0. Install Docker (if you don't have it already)
1. `docker pull swaggerapi/swagger-ui`
2. `docker run --rm --name swagger-ui -d -p 80:8080 -e SWAGGER_JSON=/doc/operator-api.yaml -v /path/to/repo/doc/api:/doc swaggerapi/swagger-ui` ***Make sure to change /path/to/repo. Tip: in Docker you can use ${PWD} to reference the current path.***
3. Use your browser: http://localhost:80
4. To stop the server: `docker kill swagger-ui`

- Publish the doc on [swagger hub](https://swagger.io/tools/swaggerhub/)???

***More info about swagger-ui on the*** [GitHub repo](https://github.com/swagger-api/swagger-ui)
