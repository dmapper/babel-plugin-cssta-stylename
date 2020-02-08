# babel-plugin-cssta-stylename

Create `cssta` custom components out of a standalone css file.

## Idea

- Use `styleName` attribute to get the styles for a particular class from the css file.
- Attributes in CSS are written using regular syntax (without `@`). `@` gets added during the compilation. The reason to get rid of `@` in css is because of the poor syntax highlighting. Also in future it makes sense to make removal of css-only attributes optional in `cssta`. And instead let them flow through into the underlying component.
- Other than that, pretty much all the functionality and syntax of `cssta` should stay the same.

To see an example check the `__tests__/__fixtures__` folder.

## Installation

```
# babel-plugin-cssta has to be a regular dependency
# because it's being used in runtime
npm i --save babel-plugin-cssta
npm i --save-dev babel-plugin-cssta-stylename
```

Specify babel plugins in the following order and before any other plugins you might already have:

```json
[
  ["babel-plugin-cssta-stylename", {
    "classAttribute": "styleName",
    "addCssHash": false,
    "extensions": [".css", ".styl"]
  }],
  "babel-plugin-cssta"
]
```

### Options

- `classAttribute` - what attribute to use for the class name. Default: `"styleName"`.
- `addCssHash` - automatically add comment with unique hash on the css `import` line of the `.js`/`.jsx` file with the same name and in the same directory as the css file. Useful to have it development to force trigger hot-reloading of components when changing only the css file. Default: `false`
- `extensions` - which style imports to parse. Besides regular css, stylus preprocessor is also supported.

## Test

```sh
yarn test
```

## License

MIT

(c) Pavel Zhukov - cray0000
