# Batch Explorer
Service that provides an HTTP API interface in order to provide rollup related information to clients

## API

The API specification is written following the [Open API Specification (OAS) 3.0](https://swagger.io/specification/).
In order to make life easier some [open source tools](https://swagger.io/tools/open-source/) are used to:
- Edit the specification.
- Generate server code: endpoints and validation.
- Host a nice looking and interactive documentation.

***All the following commands are supposed to be run from the root of this git repo***

###  View / Edit the specification

Of course you can use your favorite IDE to edit (path to the repo)/batch-explorer/spec.yaml. However using a OAS specific editor is recommended as it provides nice features such as validation and frontend documentation preview. The recommended editor is [Swagger editor](https://github.com/swagger-api/swagger-editor):

- Using docker:
0. Install Docker (if you don't have it already)
1. `docker pull swaggerapi/swagger-editor`
2. `docker run --rm --name swagger-editor -d -p 80:8080 swaggerapi/swagger-editor`
3. Use your browser: http://localhost:80
4. Import the file: File/Import file => (path to the repo)/batch-explorer/spec.yaml
5. Save changes: File/Save as YAML => Move the file from your Downloads directory to the path of the repo and replace the old version. ***NOTE: Docker will keep changes made to browser sessions, even if the container is restarted, however the only way to persist changes is to export the file as described in this point.***
6. To stop the server: `docker kill swagger-editor`

- Run locally *Not tested*:
0. Install Node 6.x and NPM 3.x (if you don't have it already)
1. Clone the [repo](https://github.com/swagger-api/swagger-editor)
2. Run `npm start`

- Use a hosted solution like [swagger hub](https://swagger.io/tools/swaggerhub/) *Not tested*

### Generate code

The API server code is based on the generated code of [swagger-codegen](https://github.com/swagger-api/swagger-codegen).

By doing so, consistency between documentation and the deployed service is ensured. Additionally you get effortless input validation, mock ups when the functionalities are not implemented and 0 boilerplate writing.

When changes to spec.yaml are made, the generated code should be updated, without overwriting the actual code and changes should be merged. To do so:

0. Install Docker (if you don't have it already)
1. `docker pull swaggerapi/swagger-codegen-cli-v3:3.0.11`
2. Export code in nodejs-server language: `docker run --rm --name swagger-codegen -v ${PWD}/batch-explorer:/local swaggerapi/swagger-codegen-cli-v3:3.0.11 generate -i /local/spec.yaml -l nodejs-server -o /local/codegen` ***Note that you can use other languages, for instance to generate client code***
3. Check differences between fresh generated code (batch-explorer/codegen) and current server code (batch-explorer/code). It's recommended to use a diff tool such as [Meld](http://meldmerge.org/) to see changes and merge them. In general the changing parts are: batch-explorer/src/api/swagger.yaml (take all the changes from the codegen version), files under the controller directory (only take the function definitions and inputs from codegen), files under the service directory (only take the function definitions and the example values in case the logic is not implemented yet and inputs from codegen) *If permission errors are thrown, run:* `sudo chown -R $USER batch-explorer/codegen`

### Run the API server

1. Run the server: `cd batch-explorer/src && npm start & cd ../..`
2. The server will be listening at http://localhost:8080. To easily test changes, the specification can be imported in [Postman](https://www.getpostman.com/) as a collection (In postman: import -> path/to/repoDirectory/batch-explorer/spec.yaml).
3. To stop the server: `kill -9 $(lsof -t -i:8080)`


### View the documentation

In order to offer access to the API documentation to consumers and developers, [Swagger UI](https://github.com/swagger-api/swagger-ui) is used. This can be hosted in different ways:

- Using docker:
0. Install Docker (if you don't have it already)
1. `docker pull swaggerapi/swagger-ui`
2. `docker run --rm --name swagger-ui -d -p 80:8080 -e SWAGGER_JSON=/doc/spec.yaml -v ${PWD}/batch-explorer:/doc swaggerapi/swagger-ui`
3. Use your browser: http://localhost:80
4. To stop the server: `docker kill swagger-ui`

- Publish the doc on [swagger hub](https://app.swaggerhub.com/apis/rollupJuniors/Rollup)

## Deploy

TBD
