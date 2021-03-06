var BABYLON;
(function (BABYLON) {
    var EDITOR;
    (function (EDITOR) {
        var ProjectExporter = (function () {
            function ProjectExporter() {
            }
            // Public members
            // None
            // Private members
            // None
            // Exports the project
            ProjectExporter.ExportProject = function (core, requestMaterials) {
                if (requestMaterials === void 0) { requestMaterials = false; }
                BABYLON.SceneSerializer.ClearCache();
                if (!core.isPlaying)
                    EDITOR.SceneManager.SwitchActionManager();
                var project = {
                    globalConfiguration: this._SerializeGlobalAnimations(),
                    materials: [],
                    particleSystems: [],
                    nodes: [],
                    shadowGenerators: [],
                    postProcesses: this._SerializePostProcesses(),
                    lensFlares: this._SerializeLensFlares(core),
                    renderTargets: this._SerializeRenderTargets(core),
                    actions: this._SerializeActionManager(core.currentScene),
                    physicsEnabled: core.currentScene.isPhysicsEnabled(),
                    sounds: this._SerializeSounds(core),
                    requestedMaterials: requestMaterials ? [] : undefined,
                    customMetadatas: this._SerializeCustomMetadatas()
                };
                this._TraverseNodes(core, null, project);
                if (!core.isPlaying)
                    EDITOR.SceneManager.SwitchActionManager();
                return JSON.stringify(project, null, "\t");
            };
            // Serialize global animations
            ProjectExporter._SerializeGlobalAnimations = function () {
                var config = {
                    globalAnimationSpeed: EDITOR.SceneFactory.AnimationSpeed,
                    framesPerSecond: EDITOR.GUIAnimationEditor.FramesPerSecond,
                    animatedAtLaunch: []
                };
                for (var i = 0; i < EDITOR.SceneFactory.NodesToStart.length; i++) {
                    var node = EDITOR.SceneFactory.NodesToStart[i];
                    var type = "Node";
                    if (node instanceof BABYLON.Scene) {
                        type = "Scene";
                    }
                    else if (node instanceof BABYLON.Sound) {
                        type = "Sound";
                    }
                    else if (node instanceof BABYLON.ParticleSystem) {
                        type = "ParticleSystem";
                    }
                    var obj = {
                        name: node.name,
                        type: type
                    };
                    config.animatedAtLaunch.push(obj);
                }
                return config;
            };
            // Serialize sounds
            ProjectExporter._SerializeSounds = function (core) {
                var config = [];
                var index = 0;
                for (index = 0; index < core.currentScene.soundTracks[0].soundCollection.length; index++) {
                    var sound = core.currentScene.soundTracks[0].soundCollection[index];
                    if (!BABYLON.Tags.HasTags(sound) || !BABYLON.Tags.MatchesQuery(sound, "added"))
                        continue;
                    config.push({
                        name: sound.name,
                        serializationObject: sound.serialize()
                    });
                }
                return config;
            };
            // Serialize render targets
            ProjectExporter._SerializeRenderTargets = function (core) {
                var config = [];
                var index = 0;
                // Probes
                for (index = 0; index < core.currentScene.reflectionProbes.length; index++) {
                    var rp = core.currentScene.reflectionProbes[index];
                    var attachedMesh = rp._attachedMesh;
                    var obj = {
                        isProbe: true,
                        serializationObject: {}
                    };
                    if (attachedMesh) {
                        obj.serializationObject.attachedMeshId = attachedMesh.id;
                    }
                    obj.serializationObject.name = rp.name;
                    obj.serializationObject.size = rp.cubeTexture.getBaseSize().width;
                    obj.serializationObject.generateMipMaps = rp.cubeTexture._generateMipMaps;
                    obj.serializationObject.renderList = [];
                    for (var i = 0; i < rp.renderList.length; i++) {
                        obj.serializationObject.renderList.push(rp.renderList[i].id);
                    }
                    config.push(obj);
                }
                // Render targets
                for (index = 0; index < core.currentScene.customRenderTargets.length; index++) {
                    var rt = core.currentScene.customRenderTargets[index];
                    if (!BABYLON.Tags.HasTags(rt) || !BABYLON.Tags.MatchesQuery(rt, "added"))
                        continue;
                    var obj = {
                        isProbe: false,
                        serializationObject: rt.serialize()
                    };
                    config.push(obj);
                }
                // Mirror textures
                for (index = 0; index < core.currentScene.textures.length; index++) {
                    var tex = core.currentScene.textures[index];
                    if (!BABYLON.Tags.HasTags(tex) || !BABYLON.Tags.MatchesQuery(tex, "added"))
                        continue;
                    if (tex instanceof BABYLON.MirrorTexture) {
                        var obj = {
                            isProbe: false,
                            serializationObject: tex.serialize()
                        };
                        config.push(obj);
                    }
                }
                return config;
            };
            // Serialize lens flares
            ProjectExporter._SerializeLensFlares = function (core) {
                var config = [];
                for (var i = 0; i < core.currentScene.lensFlareSystems.length; i++) {
                    var lf = core.currentScene.lensFlareSystems[i];
                    var obj = {
                        serializationObject: lf.serialize()
                    };
                    var flares = obj.serializationObject.flares;
                    for (var i = 0; i < flares.length; i++) {
                        flares[i].base64Name = flares[i].textureName;
                        delete flares[i].textureName;
                        flares[i].base64Buffer = lf.lensFlares[i].texture._buffer;
                    }
                    config.push(obj);
                }
                return config;
            };
            // Serialize  post-processes
            ProjectExporter._SerializePostProcesses = function () {
                var config = [];
                if (EDITOR.SceneFactory.StandardPipeline) {
                    config.push({
                        serializationObject: EDITOR.SceneFactory.StandardPipeline.serialize()
                    });
                }
                return config;
            };
            // Traverses nodes
            ProjectExporter._TraverseNodes = function (core, node, project) {
                var scene = core.currentScene;
                if (!node) {
                    this._TraverseNodes(core, core.currentScene, project);
                    var rootNodes = [];
                    this._FillRootNodes(core, rootNodes, "lights");
                    this._FillRootNodes(core, rootNodes, "cameras");
                    this._FillRootNodes(core, rootNodes, "meshes");
                    for (var i = 0; i < rootNodes.length; i++) {
                        this._TraverseNodes(core, rootNodes[i], project);
                    }
                }
                else {
                    if (node !== core.camera) {
                        // Check particle systems
                        for (var i = 0; i < scene.particleSystems.length; i++) {
                            var ps = scene.particleSystems[i];
                            if (ps.emitter === node) {
                                var psObj = {
                                    hasEmitter: !(BABYLON.Tags.HasTags(node) && BABYLON.Tags.MatchesQuery(node, "added_particlesystem")),
                                    serializationObject: ps.serialize()
                                };
                                if (!psObj.hasEmitter)
                                    psObj.emitterPosition = ps.emitter.position.asArray();
                                // Patch texture base64 string
                                psObj.serializationObject.base64TextureName = ps.particleTexture.name;
                                psObj.serializationObject.base64Texture = ps.particleTexture._buffer;
                                delete psObj.serializationObject.textureName;
                                project.particleSystems.push(psObj);
                            }
                        }
                        // Check materials
                        if (node instanceof BABYLON.AbstractMesh && node.material && (!(node.material instanceof BABYLON.StandardMaterial) || BABYLON.Tags.MatchesQuery(node.material, "added"))) {
                            var material = node.material;
                            if (!BABYLON.Tags.HasTags(material) || !BABYLON.Tags.MatchesQuery(material, "furShellMaterial")) {
                                if (material instanceof BABYLON.MultiMaterial) {
                                    for (var materialIndex = 0; materialIndex < material.subMaterials.length; materialIndex++) {
                                        var subMaterial = material.subMaterials[materialIndex];
                                        if (!(subMaterial instanceof BABYLON.StandardMaterial)) {
                                            var matObj = {
                                                meshesNames: [node.name],
                                                newInstance: true,
                                                serializedValues: subMaterial.serialize()
                                            };
                                            this._ConfigureMaterial(material, matObj);
                                            project.materials.push(matObj);
                                            this._RequestMaterial(core, project, subMaterial);
                                        }
                                    }
                                }
                                var serializedMaterial = this._GetSerializedMaterial(project, material.name);
                                if (serializedMaterial) {
                                    serializedMaterial.meshesNames.push(node.name);
                                }
                                else {
                                    var matObj = {
                                        meshesNames: [node.name],
                                        newInstance: true,
                                        serializedValues: material.serialize()
                                    };
                                    this._ConfigureMaterial(material, matObj);
                                    project.materials.push(matObj);
                                    this._RequestMaterial(core, project, material);
                                }
                            }
                        }
                        // Check modified nodes
                        var nodeObj = {
                            name: node instanceof BABYLON.Scene ? "Scene" : node.name,
                            id: node instanceof BABYLON.Scene ? "Scene" : node instanceof BABYLON.Sound ? "Sound" : node.id,
                            type: node instanceof BABYLON.Scene ? "Scene"
                                : node instanceof BABYLON.Sound ? "Sound"
                                    : node instanceof BABYLON.Light ? "Light"
                                        : node instanceof BABYLON.Camera ? "Camera"
                                            : node instanceof BABYLON.InstancedMesh ? "InstancedMesh"
                                                : "Mesh",
                            animations: []
                        };
                        var addNodeObj = false;
                        if (BABYLON.Tags.HasTags(node)) {
                            if (BABYLON.Tags.MatchesQuery(node, "added_particlesystem"))
                                addNodeObj = true;
                            if (BABYLON.Tags.MatchesQuery(node, "added")) {
                                addNodeObj = true;
                                if (node instanceof BABYLON.InstancedMesh) {
                                    var serializedInstances = BABYLON.SceneSerializer.SerializeMesh(node.sourceMesh, false, false).meshes[0].instances;
                                    var sourceMesh = node.sourceMesh;
                                    for (var j = 0; j < serializedInstances.length; j++) {
                                        if (serializedInstances[j].name === node.name) {
                                            nodeObj.serializationObject = serializedInstances[j];
                                            nodeObj.serializationObject.sourceMesh = sourceMesh.id;
                                            break;
                                        }
                                    }
                                }
                                else if (node instanceof BABYLON.Mesh) {
                                    nodeObj.serializationObject = BABYLON.SceneSerializer.SerializeMesh(node, false, false);
                                    for (var meshIndex = 0; meshIndex < nodeObj.serializationObject.meshes.length; meshIndex++) {
                                        delete nodeObj.serializationObject.meshes[meshIndex].animations;
                                        delete nodeObj.serializationObject.meshes[meshIndex].actions;
                                    }
                                }
                                else {
                                    nodeObj.serializationObject = node.serialize();
                                    delete nodeObj.serializationObject.animations;
                                }
                                delete nodeObj.serializationObject.animations;
                            }
                        }
                        // Shadow generators
                        if (node instanceof BABYLON.Light) {
                            var shadows = node.getShadowGenerator();
                            if (shadows && BABYLON.Tags.HasTags(shadows) && BABYLON.Tags.MatchesQuery(shadows, "added"))
                                project.shadowGenerators.push(node.getShadowGenerator().serialize());
                        }
                        // Check animations
                        if (node.animations) {
                            var animatable = node;
                            for (var animIndex = 0; animIndex < animatable.animations.length; animIndex++) {
                                var animation = animatable.animations[animIndex];
                                if (!BABYLON.Tags.HasTags(animation) || !BABYLON.Tags.MatchesQuery(animation, "modified"))
                                    continue;
                                addNodeObj = true;
                                // Add values
                                var animObj = {
                                    events: [],
                                    serializationObject: animation.serialize(),
                                    targetName: node instanceof BABYLON.Scene ? "Scene" : node.name,
                                    targetType: node instanceof BABYLON.Scene ? "Scene" : node instanceof BABYLON.Sound ? "Sound" : "Node",
                                };
                                // Setup events
                                /*
                                var keys = animation.getKeys();
                                for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
                                    var events: INTERNAL.IAnimationEvent[] = keys[keyIndex].events;
    
                                    if (!events)
                                        continue;
    
                                    animObj.events.push({
                                        events: events,
                                        frame: keys[keyIndex].frame
                                    });
                                }
                                */
                                // Add
                                nodeObj.animations.push(animObj);
                            }
                        }
                        // Actions
                        if (node instanceof BABYLON.AbstractMesh) {
                            // Check physics
                            var physicsImpostor = node.getPhysicsImpostor();
                            if (physicsImpostor && BABYLON.Tags.HasTags(physicsImpostor) && BABYLON.Tags.MatchesQuery(physicsImpostor, "added")) {
                                addNodeObj = true;
                                nodeObj.physics = {
                                    physicsMass: node.physicsImpostor.getParam("mass"),
                                    physicsFriction: node.physicsImpostor.getParam("friction"),
                                    physicsRestitution: node.physicsImpostor.getParam("restitution"),
                                    physicsImpostor: node.physicsImpostor.type
                                };
                            }
                            // Actions
                            nodeObj.actions = this._SerializeActionManager(node);
                            if (nodeObj.actions)
                                addNodeObj = true;
                        }
                        // Add
                        if (addNodeObj) {
                            project.nodes.push(nodeObj);
                        }
                    }
                    if (node instanceof BABYLON.Node) {
                        for (var i = 0; i < node.getDescendants().length; i++) {
                            this._TraverseNodes(core, node.getDescendants()[i], project);
                        }
                    }
                }
            };
            // Serializes action manager of an object or scene
            // Returns null if does not exists or not added from the editor
            ProjectExporter._SerializeActionManager = function (object) {
                if (object.actionManager && BABYLON.Tags.HasTags(object.actionManager) && BABYLON.Tags.MatchesQuery(object.actionManager, "added")) {
                    return object.actionManager.serialize(object instanceof BABYLON.Scene ? "Scene" : object.name);
                }
                return null;
            };
            // Serializes the custom metadatas, largely used by plugins like post-process builder
            // plugin.
            ProjectExporter._SerializeCustomMetadatas = function () {
                var dict = {};
                for (var thing in EDITOR.SceneManager._CustomMetadatas) {
                    dict[thing] = EDITOR.SceneManager._CustomMetadatas[thing];
                }
                return dict;
            };
            // Setups the requested materials (to be uploaded in template or release)
            ProjectExporter._RequestMaterial = function (core, project, material) {
                if (!material || material instanceof BABYLON.StandardMaterial || material instanceof BABYLON.MultiMaterial || material instanceof BABYLON.PBRMaterial || !project.requestedMaterials)
                    return;
                var constructorName = material.constructor ? material.constructor.name : null;
                if (!constructorName)
                    return;
                var index = project.requestedMaterials.indexOf(constructorName);
                if (index === -1)
                    project.requestedMaterials.push(constructorName);
            };
            // Returns if a material has been already serialized
            ProjectExporter._GetSerializedMaterial = function (project, materialName) {
                for (var i = 0; i < project.materials.length; i++) {
                    if (project.materials[i].serializedValues.name === materialName)
                        return project.materials[i];
                }
                return null;
            };
            // Configures the material (configure base64 textures etc.)
            ProjectExporter._ConfigureMaterial = function (material, projectMaterial) {
                for (var thing in material) {
                    var value = material[thing];
                    if (!(value instanceof BABYLON.BaseTexture) || !projectMaterial.serializedValues[thing] || !value._buffer)
                        continue;
                    projectMaterial.serializedValues[thing].base64String = value._buffer;
                }
            };
            // Configures the texture (configure base64 texture)
            ProjectExporter._ConfigureBase64Texture = function (source, objectToConfigure) {
                for (var thing in source) {
                    var value = source[thing];
                    if (!(value instanceof BABYLON.BaseTexture) || !objectToConfigure[thing] || !value._buffer)
                        continue;
                    objectToConfigure[thing].base64String = value._buffer;
                }
                return objectToConfigure;
            };
            // Fills array of root nodes
            ProjectExporter._FillRootNodes = function (core, data, propertyPath) {
                var scene = core.currentScene;
                var nodes = scene[propertyPath];
                for (var i = 0; i < nodes.length; i++) {
                    if (!nodes[i].parent)
                        data.push(nodes[i]);
                }
            };
            return ProjectExporter;
        }());
        EDITOR.ProjectExporter = ProjectExporter;
    })(EDITOR = BABYLON.EDITOR || (BABYLON.EDITOR = {}));
})(BABYLON || (BABYLON = {}));

//# sourceMappingURL=babylon.editor.projectExporter.js.map
