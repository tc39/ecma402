Render: 

```
npm install ecmarkup -g;

cd spec;

ecmarkup source/index.html index.html;
```

Update gh-pages: 

```
# Commit rendered changes, then:
git checkout gh-pages;
git merge master;
cp spec/index.html index.html
```
