# babel-plugin-cssta-stylename

Create `cssta` custom components out of a standalone css file.

**POC**. Not ready for production yet

## Idea

- Use `styleName` attribute is to get the styles for a particular class from the css file.
- Attributes in CSS are written using regular syntax (without `@`). `@` gets added during the compilation. The reason to get rid of `@` in css is because of the poor syntax highlighting. Also in future it makes sense to make removal of css-only attributes optional in `cssta`. And instead let them flow through into the underlying component.
- Other than that, pretty much all the functionality and syntax of `cssta` should stay the same.

## Installation

Plug in babel plugins in the following order:

```json
[
  "@babel/plugin-syntax-jsx",
  "babel-plugin-cssta-stylename",
  "babel-plugin-cssta"
]
```

## Test

```sh
yarn test
```

## License

MIT

(c) Pavel Zhukov - cray0000
