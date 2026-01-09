# Tile Objects (tob) Asset Type Editor

```typescript
// A string that contains a globally unique identifier hash
type Gid = string

// Entities
// ----
// Entities have a unique gid and are stored in a separate files

interface Tileset {
    type: "tileset"
    gid: Gid,
    file: string
    tw: int
    th: int
    w: int
} 

interface 

interface Sequence {
    name: string
    frames: Frame[]
}

interface Frame {
    // Gid of the tileset
    tgid: Gid,
    d: number[],
    w: number
}
```

This asset editor plugin lets you create and edit tile-objects (tobs) from tilesets

Tile objects are a type of object that is made up of multiple fixed-size tiles from a tileset. Similar to how objects in 8 and 16 bit consoles were made up of multiple fixed-size sprites 

´´´json
{
    "type":"tileobjects",
    "tileset": {
        // defines the base image that is used as a tileset
        "path": "../path/to/image.png",
        // tilewidth in px
        "w": 16,
        // tileheight in px
        "h": 16,
        "tilesPerRow": "16"
    },
    "objects": [
        {
            "name": "my-tile-object"            
            "sequences": {
                // by default each tob contains at least the "default" sequence with a single frame
                "default": [
                    // frame definition
                    {
                        // width of the object in tiles
                        "w": 2
                        // tile id sequence, must be multiple of w, 0 means no-tile
                        "t": [0,1,0,2]
                    }
                ]
            }
        }   
    ],
}
´´´